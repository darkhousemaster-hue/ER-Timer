# -*- coding: utf-8 -*-
import base64, os

ROOT = r'C:\Users\darkh\OneDrive\Documents\er-timer'
IMG  = os.path.join(ROOT, 'docs', 'img')

def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()

def img_uri(name):
    return 'data:image/png;base64,' + b64(os.path.join(IMG, name))

icon = 'data:image/png;base64,' + b64(os.path.join(ROOT, 'assets', 'icons', 'icon.png'))

S = {n: img_uri(n + '.png') for n in [
    'timer','fullscreen','text-hints','hint-sound','picture-hints',
    'manager','two-rooms','player-screen','minimize-button'
]}

HTML = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>ER Timer - Handbook</title>
<style>
  @page {{ size: A4; margin: 16mm 15mm 18mm 15mm; }}
  *{{box-sizing:border-box}}
  html,body{{margin:0;padding:0}}
  body{{
    font:11pt/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:#1c1c22;-webkit-print-color-adjust:exact;print-color-adjust:exact;
  }}
  .accent{{color:#c0392b}}
  /* ---- cover ---- */
  .cover{{
    height:255mm;display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;page-break-after:always;
  }}
  .cover img.logo{{width:120px;height:120px;border-radius:26px;
    box-shadow:0 6px 28px rgba(0,0,0,.18);margin-bottom:26px}}
  .cover h1{{font-size:34pt;margin:0;letter-spacing:-.5px}}
  .cover .sub{{font-size:13pt;color:#5c5c66;margin-top:10px}}
  .cover .ver{{margin-top:30px;font:600 10pt "Segoe UI";color:#9a9aa2;
    border:1px solid #e3e3dd;border-radius:20px;padding:5px 14px}}
  .cover .note{{margin-top:14px;font-size:9.5pt;color:#8a8a92;max-width:360px}}
  /* ---- toc ---- */
  .toc{{page-break-after:always;padding-top:6mm}}
  .toc h2{{font-size:16pt;margin:0 0 14px;border-bottom:2px solid #c0392b;padding-bottom:6px;display:inline-block}}
  .toc ol{{padding-left:0;list-style:none;counter-reset:t;font-size:11.5pt}}
  .toc li{{counter-increment:t;padding:7px 0;border-bottom:1px dotted #ddd;display:flex;align-items:center;gap:10px}}
  .toc li::before{{content:counter(t);background:#fdecea;color:#c0392b;font-weight:700;
    width:24px;height:24px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:10pt}}
  /* ---- feature sections ---- */
  .feature{{page-break-inside:avoid;margin:0 0 13mm}}
  .feature h2{{font-size:15pt;margin:0 0 3px;display:flex;align-items:center;gap:9px}}
  .feature h2 .n{{background:#c0392b;color:#fff;width:26px;height:26px;border-radius:7px;
    display:inline-flex;align-items:center;justify-content:center;font-size:11pt;font-weight:700;flex:none}}
  .feature .lead{{color:#5c5c66;margin:0 0 9px;font-size:10.5pt}}
  .shot{{border:1px solid #e3e3dd;border-radius:10px;overflow:hidden;margin:9px 0;
    box-shadow:0 1px 3px rgba(0,0,0,.05);background:#fbfbfa}}
  .shot img{{display:block;width:100%}}
  .shot.center{{display:flex;justify-content:center;background:#eef1f5;padding:14px}}
  .shot.center img{{width:auto;max-height:74mm}}
  .shot.small img{{width:auto;max-width:78mm;margin:0 auto}}
  .cap{{font-size:8.5pt;color:#8a8a92;text-align:center;padding:6px 8px;border-top:1px solid #eee;background:#fff}}
  ul.body{{margin:7px 0;padding-left:18px}} ul.body li{{margin:4px 0}}
  ol.steps{{counter-reset:s;list-style:none;padding-left:0;margin:8px 0}}
  ol.steps li{{counter-increment:s;position:relative;padding-left:30px;margin:7px 0}}
  ol.steps li::before{{content:counter(s);position:absolute;left:0;top:0;background:#1a1a2e;color:#fff;
    width:21px;height:21px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9pt;font-weight:700}}
  .btn{{display:inline-block;background:#eef0f2;border:1px solid #dcdce0;border-bottom-width:2px;
    border-radius:5px;padding:0 6px;font:600 9.5pt "Segoe UI";white-space:nowrap}}
  .btn.go{{background:#e7f6ee;border-color:#bfe6d0}} .btn.warn{{background:#fdecea;border-color:#f3cfca}}
  .tip{{background:#f6f9ff;border-left:3px solid #6b8afd;border-radius:7px;padding:9px 12px;margin:9px 0;font-size:9.5pt;color:#33405e}}
  .tip b{{color:#26314d}}
  .lock{{background:#fafafa;border:1px dashed #ddd;border-radius:7px;padding:9px 12px;color:#5c5c66;font-size:9.5pt}}
  table{{border-collapse:collapse;width:100%;margin:8px 0;font-size:9.5pt}}
  th,td{{border:1px solid #e3e3dd;padding:5px 9px;text-align:left}} th{{background:#f2f2ef}}
  .badge{{background:#e8a33d;color:#fff;font-size:7.5pt;font-weight:700;border-radius:5px;padding:2px 6px;margin-left:7px;vertical-align:middle;letter-spacing:.4px}}
  footer{{position:fixed;bottom:-12mm;left:0;right:0;text-align:center;font-size:8pt;color:#b5b5bd}}
</style>
</head>
<body>

  <section class="cover">
    <img class="logo" src="{icon}" alt="ER Timer">
    <h1>ER&nbsp;Timer <span class="accent">Handbook</span></h1>
    <div class="sub">Running a game: timer, hints &amp; player screens</div>
    <div class="ver">Version 2.1.14</div>
    <div class="note">Covers only the controls you can use without the Manager password.
    Setup options behind Manager Mode are intentionally not included.</div>
  </section>

  <section class="toc">
    <h2>Contents</h2>
    <ol>
      <li>Windows &amp; Always-on-Top</li>
      <li>Minimize to Icon Button</li>
      <li>The Timer</li>
      <li>One or Two Rooms</li>
      <li>Fullscreen</li>
      <li>Text Hints</li>
      <li>Hint Sound</li>
      <li>Picture Hints</li>
      <li>Manager Mode</li>
    </ol>
  </section>

  <section class="feature">
    <h2><span class="n">1</span>Windows &amp; Always-on-Top</h2>
    <p class="lead">ER Timer uses two kinds of window.</p>
    <ul class="body">
      <li><b>Control window</b> - the panel you operate (timer and hints).</li>
      <li><b>Player window</b> - the large clock your players see, one per room (shown below).</li>
    </ul>
    <p>The Control window is <b>always-on-top</b>: it stays above other programs, so clicking another
    app (a browser, music player, etc.) never hides or buries it.</p>
    <div class="shot center"><img src="{S['player-screen']}" alt="Player window"></div>
    <div class="cap">The player window: large countdown with a hint banner underneath.</div>
    <div class="tip"><b>Closing the Control window</b> shuts down the whole app, including the player screen(s).</div>
  </section>

  <section class="feature">
    <h2><span class="n">2</span>Minimize to Icon Button <span class="badge">FEATURE</span></h2>
    <p class="lead">Tuck the panel away without losing it - and without it dropping behind other windows.</p>
    <ol class="steps">
      <li>Click the window's <b>minimize</b> button. The Control window disappears.</li>
      <li>A small <b>floating icon button</b> (desktop-shortcut sized, showing the ER Timer icon) appears in the <b>bottom-right corner</b> of your main screen.</li>
      <li>That button <b>always stays on top</b> of every other program, so you can always find it.</li>
      <li><b>Click the icon button</b> and the Control window reopens at the exact same size and position as before.</li>
    </ol>
    <div class="shot small"><img src="{S['minimize-button']}" alt="Minimize icon button"></div>
    <div class="cap">The floating icon button shown over the desktop.</div>
    <div class="tip"><b>Good to know:</b> while minimized, the clock keeps running and players still see their time - only your control panel is hidden. The button has no taskbar entry.</div>
  </section>

  <section class="feature">
    <h2><span class="n">3</span>The Timer</h2>
    <p class="lead">A four-digit MM:SS clock, shown on the player screen.</p>
    <p>Each digit has a <span class="btn">+</span> above it and a <span class="btn">-</span> below it -
    tap them to dial in minutes and seconds before you start.</p>
    <div class="shot small"><img src="{S['timer']}" alt="Timer controls"></div>
    <div class="cap">Digit steppers and the Start / Reset / Pause buttons.</div>
    <table>
      <tr><th>Button</th><th>What it does</th></tr>
      <tr><td><span class="btn go">Start</span></td><td>Begins counting down from the set time.</td></tr>
      <tr><td><span class="btn">Pause</span></td><td>Freezes the clock; press Start to resume.</td></tr>
      <tr><td><span class="btn warn">Reset</span></td><td>Stops and returns to the default start time.</td></tr>
    </table>
    <div class="tip">The clock runs in the app's core process, so it keeps <b>perfect time even when minimized</b> or when other windows are busy.</div>
  </section>

  <section class="feature">
    <h2><span class="n">4</span>One or Two Rooms</h2>
    <p class="lead">Run a single room, or two rooms side by side.</p>
    <ul class="body">
      <li>The <span class="btn">2 Rooms</span> checkbox turns the second room (and its player screen) on or off.</li>
      <li>With two rooms on, each room has its own column - text hint, hint sound and picture hints - working independently.</li>
    </ul>
    <div class="shot"><img src="{S['two-rooms']}" alt="Two rooms side by side"></div>
    <div class="cap">Two-room view: each room is controlled separately.</div>
  </section>

  <section class="feature">
    <h2><span class="n">5</span>Fullscreen</h2>
    <p class="lead">Each room's player screen can be windowed or full screen.</p>
    <p>Click the <span class="btn">&#9974;</span> button at the top of a room's column to toggle that
    room's <b>player window</b> in and out of full screen.</p>
    <div class="shot small"><img src="{S['fullscreen']}" alt="Fullscreen toggle"></div>
    <div class="cap">The fullscreen toggle sits beside the room name.</div>
  </section>

  <section class="feature">
    <h2><span class="n">6</span>Text Hints</h2>
    <p class="lead">Send a written clue to the player screen.</p>
    <ol class="steps">
      <li>Type your clue in the <b>"Type a hint..."</b> box.</li>
      <li>Click <span class="btn go">Send</span> (or press <b>Enter</b>) to show it on that room's player screen.</li>
      <li>Click <span class="btn">Delete</span> to clear the text hint and empty the box.</li>
    </ol>
    <div class="shot"><img src="{S['text-hints']}" alt="Text hint input"></div>
    <div class="cap">Type a clue, then Send it to the players.</div>
  </section>

  <section class="feature">
    <h2><span class="n">7</span>Hint Sound</h2>
    <p class="lead">An optional sound that plays on the player screen when you send a hint.</p>
    <ul class="body">
      <li>The <b>Hint sound</b> checkbox (per room) turns that sound on or off.</li>
      <li><span class="btn">&#9654; Test</span> plays the sound once so you can check it.</li>
    </ul>
    <div class="shot small"><img src="{S['hint-sound']}" alt="Hint sound controls"></div>
    <div class="cap">Per-room hint-sound toggle and Test button.</div>
    <div class="lock">Which sound file is used is chosen in the password-protected Manager area.</div>
  </section>

  <section class="feature">
    <h2><span class="n">8</span>Picture Hints</h2>
    <p class="lead">Push a prepared picture to the player screen with a single click.</p>
    <p>Picture hints are organised into <b>Phases</b>; each phase contains <b>Riddles</b>; each riddle
    contains one or more <b>images</b>. (This library is prepared in advance in Manager Mode.)</p>
    <ol class="steps">
      <li>Click a <b>Phase</b> to expand it, then a <b>Riddle</b> to reveal its images.</li>
      <li><b>Click an image</b> - it appears on the player screen at once, and the chosen thumbnail is highlighted.</li>
      <li>Click a different image to switch; the new one replaces the old.</li>
    </ol>
    <div class="shot"><img src="{S['picture-hints']}" alt="Picture hints library"></div>
    <div class="cap">Phases &rarr; Riddles &rarr; images. The highlighted thumbnail is live on screen.</div>
    <table>
      <tr><th>Button</th><th>What it does</th></tr>
      <tr><td><span class="btn">Remove picture</span></td><td>Takes the current image off the player screen (any text hint stays).</td></tr>
      <tr><td><span class="btn warn">Remove all</span></td><td>Clears both the text hint and the image for that room at once.</td></tr>
    </table>
    <div class="tip"><b>Images only.</b> Picture hints accept still images - PNG, JPG, GIF, WEBP, BMP.
    There is no video hint; an <b>animated GIF</b> is the closest motion option.</div>
  </section>

  <section class="feature">
    <h2><span class="n">9</span>Manager Mode</h2>
    <p class="lead">The <span class="btn">&#128274; Manager Mode</span> button opens a password-protected area for one-time setup.</p>
    <div class="shot"><img src="{S['manager']}" alt="Settings header with Manager Mode"></div>
    <div class="cap">The Settings header, with the Manager Mode lock and the 2 Rooms toggle.</div>
    <div class="lock">Everything behind that password is <b>intentionally not covered in this handbook</b> -
    this guide is only about the controls you use while running a game.</div>
  </section>

  <footer>ER Timer Handbook &middot; v2.1.14 &middot; non-password controls</footer>
</body>
</html>'''

out_html = os.path.join(ROOT, 'docs', '_shotgen', 'handbook_print.html')
open(out_html, 'w', encoding='utf-8', newline='\n').write(HTML)
print('WROTE', len(HTML), 'bytes ->', out_html)
