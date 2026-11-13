"""Rendert de demofilm frame voor frame en maakt de eindbestanden (alleen Python-standaardbibliotheek + ffmpeg).

Gebruik:   python tools/render_film.py concept     snelle versie, 960x540  -> film/plein-air-demo-concept.mp4
           python tools/render_film.py final       4K-master -> film/plein-air-demo-4k.mp4, -1080p.mp4 en 3 stills
           python tools/render_film.py final --mux alleen opnieuw muxen vanaf een bestaande master

Werking: start een eigen server.py (poort 8765) en Chrome zonder venster op ?demo&render=<versie>.
De pagina rendert elk frame en stuurt het naar de server, die het direct aan ffmpeg geeft (film/_master-*.mp4).
Daarna komen hier de muziek (fade in 2 s, uit 3 s), de 4K- en 1080p-versie en de stills bij.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILM = os.path.join(ROOT, "film")
MUSIC = os.path.join(ROOT, "assets", "music", "gymnopedie-1-alciatore.ogg")
MUSIC_START = 1.9          # de opname begint met ~2,2 s stilte: start net voor de eerste noot
PORT = 8765
DURATION = 60
STILLS = [(14.2, "still-1-dageraad"), (44.5, "still-2-sneeuwnacht"), (54.0, "still-3-woonkamer")]


def ffmpeg():
    return shutil.which("ffmpeg") or os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe")


def chrome():
    for p in [r"%ProgramFiles%\Google\Chrome\Application\chrome.exe", r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
              r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe", r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"]:
        p = os.path.expandvars(p)
        if os.path.exists(p):
            return p
    sys.exit("Chrome of Edge niet gevonden.")


def run(cmd):
    print("  $ " + " ".join(os.path.basename(c) if i == 0 else c for i, c in enumerate(cmd)))
    subprocess.run(cmd, check=True)


def status():
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/render/status", timeout=5) as r:
        return json.load(r)


def render(version):
    server = subprocess.Popen([sys.executable, os.path.join(ROOT, "server.py"), str(PORT)], cwd=ROOT)
    profile = tempfile.mkdtemp(prefix="pleinair-chrome-")
    browser = None
    try:
        time.sleep(1.5)
        def launch(start_frame):
            url = f"http://localhost:{PORT}/?demo&render={version}" + (f"&from={start_frame}" if start_frame else "")
            return subprocess.Popen([chrome(), "--headless=new", "--use-angle=d3d11", "--enable-gpu-rasterization",
                                     "--ignore-gpu-blocklist", "--disable-background-timer-throttling",
                                     "--disable-renderer-backgrounding", "--hide-scrollbars", "--mute-audio",
                                     f"--user-data-dir={profile}", "--window-size=1280,720", url],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        browser = launch(0)
        t0, last, last_change, last_print, restarts = time.time(), -1, time.time(), 0, 0
        while True:
            time.sleep(2)
            st = status()
            if st["frames"] != last:
                last, last_change = st["frames"], time.time()
            if time.time() - last_print > 30:
                last_print = time.time()
                print(f"  frame {st['frames']}/1800  ({time.time() - t0:.0f} s)", flush=True)
            if st["state"] == "done":
                break
            if st["state"] == "error":
                sys.exit("Render mislukt: " + st["error"])
            # waakhond: Chrome kan bij 4K vastlopen; dan herstarten en verdergaan bij het volgende frame
            if st["state"] == "rendering" and time.time() - last_change > 45:
                restarts += 1
                if restarts > 30:
                    sys.exit("Chrome blijft vastlopen; render gestopt.")
                print(f"  Chrome reageert niet meer: herstart bij frame {st['frames']} (keer {restarts})", flush=True)
                browser.kill(); browser.wait()
                time.sleep(2)
                browser = launch(st["frames"])
                last_change = time.time()
            if time.time() - t0 > 4 * 3600:
                sys.exit("Render duurt te lang (meer dan 4 uur).")
        print(f"  klaar in {time.time() - t0:.0f} s -> {st['out']}")
        return st["out"]
    finally:
        if browser:
            browser.kill()
        server.kill()
        shutil.rmtree(profile, ignore_errors=True)


def audio_filter():
    # muziek: vanaf de eerste noot, op een prettig niveau, fade in 2 s en uit over de laatste 3 s
    return (f"[1:a]atrim=0:{DURATION},asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-1.5:LRA=11,"
            f"afade=t=in:st=0:d=2,afade=t=out:st={DURATION - 3}:d=3[a]")


def finish(version, master):
    ff = ffmpeg()
    music = ["-ss", str(MUSIC_START), "-i", MUSIC]
    if version == "concept":
        out = os.path.join(FILM, "plein-air-demo-concept.mp4")
        run([ff, "-y", "-loglevel", "error", "-i", master, *music, "-filter_complex", audio_filter(),
             "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", str(DURATION), "-movflags", "+faststart", out])
        return [out]
    out4k = os.path.join(FILM, "plein-air-demo-4k.mp4")
    run([ff, "-y", "-loglevel", "error", "-i", master, *music, "-filter_complex", audio_filter(),
         "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
         "-profile:v", "high", "-level", "5.1", "-r", "30", "-c:a", "aac", "-b:a", "256k", "-t", str(DURATION),
         "-movflags", "+faststart", out4k])
    # 1080p voor WhatsApp: 2-pass op ~1,5 Mbit/s → ruim onder 16 MB
    out1080 = os.path.join(FILM, "plein-air-demo-1080p.mp4")
    passlog = os.path.join(tempfile.gettempdir(), "pleinair-2pass")
    v1080 = ["-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-b:v", "1500k",
             "-maxrate", "2500k", "-bufsize", "4000k", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", "30", "-passlogfile", passlog]
    run([ff, "-y", "-loglevel", "error", "-i", master, *v1080, "-pass", "1", "-an", "-t", str(DURATION), "-f", "mp4", os.devnull])
    run([ff, "-y", "-loglevel", "error", "-i", master, *music, "-filter_complex", audio_filter(),
         "-map", "0:v", "-map", "[a]", *v1080, "-pass", "2", "-c:a", "aac", "-b:a", "128k", "-t", str(DURATION),
         "-movflags", "+faststart", out1080])
    outs = [out4k, out1080]
    for t, name in STILLS:
        png = os.path.join(FILM, name + ".png")
        run([ff, "-y", "-loglevel", "error", "-ss", str(t), "-i", master, "-frames:v", "1", png])
        outs.append(png)
    return outs


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else "concept"
    if version not in ("concept", "final"):
        sys.exit("Gebruik: python tools/render_film.py concept|final [--mux]")
    os.makedirs(FILM, exist_ok=True)
    master = os.path.join(FILM, f"_master-{version}.mp4")
    if "--mux" not in sys.argv:
        print(f"Renderen ({version})...")
        master = render(version)
    print("Muziek en eindbestanden...")
    for f in finish(version, master):
        print(f"  {os.path.relpath(f, ROOT)}  ({os.path.getsize(f) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
