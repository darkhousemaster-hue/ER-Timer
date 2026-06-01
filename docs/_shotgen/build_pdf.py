# -*- coding: utf-8 -*-
"""Generate the ER Timer handbook as print-ready HTML (EN + DE).
Images are embedded as base64 so the HTML is self-contained for Chrome --print-to-pdf.
Run, then render each *_print.html to PDF with headless Chrome.
"""
import base64, os

ROOT = r'C:\Users\darkh\OneDrive\Documents\er-timer'
IMG  = os.path.join(ROOT, 'docs', 'img')

def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()

def uri(name):
    return 'data:image/png;base64,' + b64(os.path.join(IMG, name + '.png'))

ICON = 'data:image/png;base64,' + b64(os.path.join(ROOT, 'assets', 'icons', 'icon.png'))
SHOTS = ['timer','fullscreen','text-hints','hint-sound','picture-hints',
         'manager','two-rooms','player-screen','minimize-button','update-status']
S = {n: uri(n) for n in SHOTS}

CSS = """
  @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font:11pt/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:#1c1c22;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .accent{color:#c0392b}
  .cover{height:262mm;display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;page-break-after:always;}
  .cover img.logo{width:120px;height:120px;border-radius:26px;box-shadow:0 6px 28px rgba(0,0,0,.18);margin-bottom:26px}
  .cover h1{font-size:34pt;margin:0;letter-spacing:-.5px}
  .cover .sub{font-size:13pt;color:#5c5c66;margin-top:10px}
  .cover .ver{margin-top:30px;font:600 10pt "Segoe UI";color:#9a9aa2;border:1px solid #e3e3dd;border-radius:20px;padding:5px 14px}
  .cover .note{margin-top:14px;font-size:9.5pt;color:#8a8a92;max-width:380px}
  .toc{page-break-after:always;padding-top:4mm}
  .toc h2{font-size:16pt;margin:0 0 14px;border-bottom:2px solid #c0392b;padding-bottom:6px;display:inline-block}
  .toc ol{padding-left:0;list-style:none;counter-reset:t;font-size:11.5pt}
  .toc li{counter-increment:t;padding:7px 0;border-bottom:1px dotted #ddd;display:flex;align-items:center;gap:10px}
  .toc li::before{content:counter(t);background:#fdecea;color:#c0392b;font-weight:700;width:24px;height:24px;
    border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:10pt}
  .feature{page-break-inside:avoid;margin:0 0 11mm}
  .feature h2{font-size:15pt;margin:0 0 3px;display:flex;align-items:center;gap:9px}
  .feature h2 .n{background:#c0392b;color:#fff;width:26px;height:26px;border-radius:7px;display:inline-flex;
    align-items:center;justify-content:center;font-size:11pt;font-weight:700;flex:none}
  .feature .lead{color:#5c5c66;margin:0 0 9px;font-size:10.5pt}
  .shot{border:1px solid #e3e3dd;border-radius:10px;overflow:hidden;margin:9px 0;
    box-shadow:0 1px 3px rgba(0,0,0,.05);background:#fbfbfa}
  .shot img{display:block;width:100%}
  /* cap tall shots so they never overflow a page (fixes blank page after a section) */
  .shot.center{display:flex;justify-content:center;background:#eef1f5;padding:14px}
  .shot.center img{width:auto;max-height:70mm}
  .shot.small img{width:auto;max-width:80mm;margin:0 auto}
  .shot.tall{display:flex;justify-content:center;background:#fbfbfa;padding:10px}
  .shot.tall img{width:auto;max-height:118mm}
  .cap{font-size:8.5pt;color:#8a8a92;text-align:center;padding:6px 8px;border-top:1px solid #eee;background:#fff}
  ul.body{margin:7px 0;padding-left:18px} ul.body li{margin:4px 0}
  ol.steps{counter-reset:s;list-style:none;padding-left:0;margin:8px 0}
  ol.steps li{counter-increment:s;position:relative;padding-left:30px;margin:7px 0}
  ol.steps li::before{content:counter(s);position:absolute;left:0;top:0;background:#1a1a2e;color:#fff;width:21px;height:21px;
    border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9pt;font-weight:700}
  .btn{display:inline-block;background:#eef0f2;border:1px solid #dcdce0;border-bottom-width:2px;border-radius:5px;
    padding:0 6px;font:600 9.5pt "Segoe UI";white-space:nowrap}
  .btn.go{background:#e7f6ee;border-color:#bfe6d0} .btn.warn{background:#fdecea;border-color:#f3cfca}
  .tip{background:#f6f9ff;border-left:3px solid #6b8afd;border-radius:7px;padding:9px 12px;margin:9px 0;font-size:9.5pt;color:#33405e}
  .tip b{color:#26314d}
  .lock{background:#fafafa;border:1px dashed #ddd;border-radius:7px;padding:9px 12px;color:#5c5c66;font-size:9.5pt}
  .important{background:#fff7ed;border:1px solid #f3e3c7;border-left:4px solid #e8a33d;border-radius:7px;padding:10px 13px;margin:9px 0;font-size:10pt;color:#6b4d22}
  .important b{color:#5a3d12}
  table{border-collapse:collapse;width:100%;margin:8px 0;font-size:9.5pt}
  th,td{border:1px solid #e3e3dd;padding:5px 9px;text-align:left} th{background:#f2f2ef}
  .badge{background:#e8a33d;color:#fff;font-size:7.5pt;font-weight:700;border-radius:5px;padding:2px 6px;margin-left:7px;vertical-align:middle;letter-spacing:.4px}
"""

def page_html(lang, t):
    feats = "\n".join(t['features'])
    toc = "\n".join(f"<li>{x}</li>" for x in t['toc'])
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head><meta charset="UTF-8"><title>{t['title']}</title><style>{CSS}</style></head>
<body>
  <section class="cover">
    <img class="logo" src="{ICON}" alt="ER Timer">
    <h1>ER&nbsp;Timer <span class="accent">{t['hb']}</span></h1>
    <div class="sub">{t['sub']}</div>
    <div class="ver">{t['ver']}</div>
    <div class="note">{t['cover_note']}</div>
  </section>
  <section class="toc"><h2>{t['contents']}</h2><ol>{toc}</ol></section>
  {feats}
</body></html>"""

# ---------------- ENGLISH ----------------
EN = {
 'title':'ER Timer - Handbook', 'hb':'Handbook',
 'sub':'Running a game: timer, hints & player screens',
 'ver':'Version 2.1.14',
 'cover_note':'Covers only the controls you can use without the Manager password. '
              'Setup options behind Manager Mode are intentionally not included.',
 'contents':'Contents',
 'toc':['Windows & Always-on-Top','Minimize to Icon Button','The Timer','One or Two Rooms',
        'Fullscreen','Text Hints','Hint Sound','Picture Hints','Updating the App','Manager Mode'],
 'features':[
  f"""<section class="feature"><h2><span class="n">1</span>Windows &amp; Always-on-Top</h2>
   <p class="lead">ER Timer uses two kinds of window.</p>
   <ul class="body"><li><b>Control window</b> - the panel you operate (timer and hints).</li>
   <li><b>Player window</b> - the large clock your players see, one per room (shown below).</li></ul>
   <p>The Control window is <b>always-on-top</b>: it stays above other programs, so clicking another app
   (a browser, music player, etc.) never hides or buries it.</p>
   <div class="shot center"><img src="{S['player-screen']}"></div>
   <div class="cap">The player window: large countdown with a hint banner underneath.</div>
   <div class="tip"><b>Closing the Control window</b> shuts down the whole app, including the player screen(s).</div></section>""",
  f"""<section class="feature"><h2><span class="n">2</span>Minimize to Icon Button <span class="badge">FEATURE</span></h2>
   <p class="lead">Tuck the panel away without losing it - and without it dropping behind other windows.</p>
   <ol class="steps">
   <li>Click the window's <b>minimize</b> button. The Control window disappears.</li>
   <li>A small <b>floating icon button</b> (desktop-shortcut sized, showing the ER Timer icon) appears in the <b>bottom-right corner</b> of your main screen.</li>
   <li>That button <b>always stays on top</b> of every other program, so you can always find it.</li>
   <li><b>Click the icon button</b> and the Control window reopens at the exact same size and position as before.</li></ol>
   <div class="shot small"><img src="{S['minimize-button']}"></div>
   <div class="cap">The floating icon button shown over the desktop.</div>
   <div class="tip"><b>Good to know:</b> while minimized, the clock keeps running and players still see their time - only your control panel is hidden. The button has no taskbar entry.</div></section>""",
  f"""<section class="feature"><h2><span class="n">3</span>The Timer</h2>
   <p class="lead">A four-digit MM:SS clock, shown on the player screen.</p>
   <p>Each digit has a <span class="btn">+</span> above it and a <span class="btn">-</span> below it -
   tap them to dial in minutes and seconds before you start.</p>
   <div class="shot small"><img src="{S['timer']}"></div>
   <div class="cap">Digit steppers and the Start / Reset / Pause buttons.</div>
   <table><tr><th>Button</th><th>What it does</th></tr>
   <tr><td><span class="btn go">Start</span></td><td>Begins counting down from the set time.</td></tr>
   <tr><td><span class="btn">Pause</span></td><td>Freezes the clock; press Start to resume.</td></tr>
   <tr><td><span class="btn warn">Reset</span></td><td>Stops and returns to the default start time.</td></tr></table>
   <div class="tip">The clock runs in the app's core process, so it keeps <b>perfect time even when minimized</b> or when other windows are busy.</div></section>""",
  f"""<section class="feature"><h2><span class="n">4</span>One or Two Rooms</h2>
   <p class="lead">Run a single room, or two rooms side by side.</p>
   <ul class="body"><li>The <span class="btn">2 Rooms</span> checkbox turns the second room (and its player screen) on or off.</li>
   <li>With two rooms on, each room has its own column - text hint, hint sound and picture hints - working independently.</li></ul>
   <div class="shot"><img src="{S['two-rooms']}"></div>
   <div class="cap">Two-room view: each room is controlled separately.</div></section>""",
  f"""<section class="feature"><h2><span class="n">5</span>Fullscreen</h2>
   <p class="lead">Each room's player screen can be windowed or full screen.</p>
   <p>Click the <span class="btn">&#9974;</span> button at the top of a room's column to toggle that room's <b>player window</b> in and out of full screen.</p>
   <div class="shot small"><img src="{S['fullscreen']}"></div>
   <div class="cap">The fullscreen toggle sits beside the room name.</div></section>""",
  f"""<section class="feature"><h2><span class="n">6</span>Text Hints</h2>
   <p class="lead">Send a written clue to the player screen.</p>
   <ol class="steps"><li>Type your clue in the <b>"Type a hint..."</b> box.</li>
   <li>Click <span class="btn go">Send</span> (or press <b>Enter</b>) to show it on that room's player screen.</li>
   <li>Click <span class="btn">Delete</span> to clear the text hint and empty the box.</li></ol>
   <div class="shot"><img src="{S['text-hints']}"></div>
   <div class="cap">Type a clue, then Send it to the players.</div></section>""",
  f"""<section class="feature"><h2><span class="n">7</span>Hint Sound</h2>
   <p class="lead">An optional sound that plays on the player screen when you send a hint.</p>
   <ul class="body"><li>The <b>Hint sound</b> checkbox (per room) turns that sound on or off.</li>
   <li><span class="btn">&#9654; Test</span> plays the sound once so you can check it.</li></ul>
   <div class="shot small"><img src="{S['hint-sound']}"></div>
   <div class="cap">Per-room hint-sound toggle and Test button.</div>
   <div class="lock">Which sound file is used is chosen in the password-protected Manager area.</div></section>""",
  f"""<section class="feature"><h2><span class="n">8</span>Picture Hints</h2>
   <p class="lead">Push a prepared picture to the player screen with a single click.</p>
   <p>Picture hints are organised into <b>Phases</b>; each phase contains <b>Riddles</b>; each riddle contains one or more <b>images</b>. (This library is prepared in advance in Manager Mode.)</p>
   <ol class="steps"><li>Click a <b>Phase</b> to expand it, then a <b>Riddle</b> to reveal its images.</li>
   <li><b>Click an image</b> - it appears on the player screen at once, and the chosen thumbnail is highlighted.</li>
   <li>Click a different image to switch; the new one replaces the old.</li></ol>
   <div class="shot tall"><img src="{S['picture-hints']}"></div>
   <div class="cap">Phases &rarr; Riddles &rarr; images. The highlighted thumbnail is live on screen.</div>
   <table><tr><th>Button</th><th>What it does</th></tr>
   <tr><td><span class="btn">Remove picture</span></td><td>Takes the current image off the player screen (any text hint stays).</td></tr>
   <tr><td><span class="btn warn">Remove all</span></td><td>Clears both the text hint and the image for that room at once.</td></tr></table>
   <div class="tip"><b>Images only.</b> Picture hints accept still images - PNG, JPG, GIF, WEBP, BMP. There is no video hint; an <b>animated GIF</b> is the closest motion option.</div></section>""",
  f"""<section class="feature"><h2><span class="n">9</span>Updating the App</h2>
   <p class="lead">ER Timer checks for updates on its own. <b>Game Masters should always install updates.</b></p>
   <p>When a new version is found, a message box appears:</p>
   <ol class="steps">
   <li>A dialog says <b>"ER Timer vX.Y.Z is available. Download now?"</b> - click <span class="btn go">Yes, Download</span>.</li>
   <li>The download runs in the background; a small bar at the bottom shows the progress.</li>
   <li>When it finishes, a dialog says <b>"Update downloaded. Restart now to install?"</b> - click <span class="btn go">Restart Now</span>.</li>
   <li>The app restarts on the new version. Done.</li></ol>
   <div class="shot small"><img src="{S['update-status']}"></div>
   <div class="cap">The download-progress bar at the bottom of the Control window.</div>
   <div class="important"><b>Always update.</b> Pick <b>Yes, Download</b> and then <b>Restart Now</b> as soon as you can - ideally between games, never mid-game. If you choose <b>Later</b>, the update installs automatically the next time you close the app.</div></section>""",
  f"""<section class="feature"><h2><span class="n">10</span>Manager Mode</h2>
   <p class="lead">The <span class="btn">&#128274; Manager Mode</span> button opens a password-protected area for one-time setup.</p>
   <div class="shot"><img src="{S['manager']}"></div>
   <div class="cap">The Settings header, with the Manager Mode lock and the 2 Rooms toggle.</div>
   <div class="lock">Everything behind that password is <b>intentionally not covered in this handbook</b> - this guide is only about the controls you use while running a game.</div></section>""",
 ],
}

# ---------------- GERMAN ----------------
DE = {
 'title':'ER Timer - Handbuch', 'hb':'Handbuch',
 'sub':'Ein Spiel leiten: Timer, Hinweise & Spieler-Bildschirme',
 'ver':'Version 2.1.14',
 'cover_note':'Behandelt nur die Bedienelemente, die ohne das Manager-Passwort nutzbar sind. '
              'Einrichtungs-Optionen hinter dem Manager-Modus sind bewusst nicht enthalten.',
 'contents':'Inhalt',
 'toc':['Fenster & Immer im Vordergrund','Zu Symbol-Schaltfläche minimieren','Der Timer','Ein oder zwei Räume',
        'Vollbild','Text-Hinweise','Hinweis-Ton','Bild-Hinweise','App aktualisieren','Manager-Modus'],
 'features':[
  f"""<section class="feature"><h2><span class="n">1</span>Fenster &amp; Immer im Vordergrund</h2>
   <p class="lead">ER Timer verwendet zwei Arten von Fenstern.</p>
   <ul class="body"><li><b>Steuerfenster</b> - das Bedienfeld, das du benutzt (Timer und Hinweise).</li>
   <li><b>Spieler-Fenster</b> - die große Uhr, die deine Spieler sehen, eines pro Raum (siehe unten).</li></ul>
   <p>Das Steuerfenster ist <b>immer im Vordergrund</b>: Es bleibt über anderen Programmen sichtbar, sodass ein Klick auf eine andere App
   (Browser, Musik-Player usw.) es nie verdeckt oder in den Hintergrund schiebt.</p>
   <div class="shot center"><img src="{S['player-screen']}"></div>
   <div class="cap">Das Spieler-Fenster: große Countdown-Anzeige mit Hinweis-Banner darunter.</div>
   <div class="tip"><b>Das Schließen des Steuerfensters</b> beendet die gesamte App, einschließlich der Spieler-Bildschirme.</div></section>""",
  f"""<section class="feature"><h2><span class="n">2</span>Zu Symbol-Schaltfläche minimieren <span class="badge">FUNKTION</span></h2>
   <p class="lead">Das Bedienfeld aus dem Weg räumen, ohne es zu verlieren - und ohne dass es hinter anderen Fenstern verschwindet.</p>
   <ol class="steps">
   <li>Klicke auf die <b>Minimieren</b>-Schaltfläche des Fensters. Das Steuerfenster verschwindet.</li>
   <li>An seiner Stelle erscheint unten rechts auf dem Hauptbildschirm eine kleine <b>schwebende Symbol-Schaltfläche</b> (so groß wie ein Desktop-Symbol, mit dem ER-Timer-Symbol).</li>
   <li>Diese Schaltfläche bleibt <b>immer im Vordergrund</b> vor allen anderen Programmen, sodass du sie immer findest.</li>
   <li><b>Klicke auf die Symbol-Schaltfläche</b> und das Steuerfenster öffnet sich wieder in genau derselben Größe und Position wie zuvor.</li></ol>
   <div class="shot small"><img src="{S['minimize-button']}"></div>
   <div class="cap">Die schwebende Symbol-Schaltfläche auf dem Desktop.</div>
   <div class="tip"><b>Gut zu wissen:</b> Während der Minimierung läuft die Uhr weiter und die Spieler sehen weiterhin ihre Zeit - nur dein Bedienfeld ist ausgeblendet. Die Schaltfläche erscheint nicht in der Taskleiste.</div></section>""",
  f"""<section class="feature"><h2><span class="n">3</span>Der Timer</h2>
   <p class="lead">Eine vierstellige MM:SS-Uhr, die auf dem Spieler-Bildschirm angezeigt wird.</p>
   <p>Jede Ziffer hat ein <span class="btn">+</span> darüber und ein <span class="btn">-</span> darunter -
   damit stellst du Minuten und Sekunden ein, bevor du startest.</p>
   <div class="shot small"><img src="{S['timer']}"></div>
   <div class="cap">Ziffern-Schalter und die Schaltflächen Start / Reset / Pause.</div>
   <table><tr><th>Schaltfläche</th><th>Funktion</th></tr>
   <tr><td><span class="btn go">Start</span></td><td>Startet den Countdown von der eingestellten Zeit.</td></tr>
   <tr><td><span class="btn">Pause</span></td><td>Hält die Uhr an; mit Start geht es weiter.</td></tr>
   <tr><td><span class="btn warn">Reset</span></td><td>Stoppt und setzt auf die Standard-Startzeit zurück.</td></tr></table>
   <div class="tip">Die Uhr läuft im Kernprozess der App und hält daher <b>auch bei Minimierung exakt die Zeit</b> oder wenn andere Fenster beschäftigt sind.</div></section>""",
  f"""<section class="feature"><h2><span class="n">4</span>Ein oder zwei Räume</h2>
   <p class="lead">Betreibe einen einzelnen Raum oder zwei Räume nebeneinander.</p>
   <ul class="body"><li>Das Kontrollkästchen <span class="btn">2 Rooms</span> schaltet den zweiten Raum (und dessen Spieler-Bildschirm) ein oder aus.</li>
   <li>Bei zwei Räumen hat jeder Raum seine eigene Spalte - Text-Hinweis, Hinweis-Ton und Bild-Hinweise - die unabhängig funktionieren.</li></ul>
   <div class="shot"><img src="{S['two-rooms']}"></div>
   <div class="cap">Zwei-Raum-Ansicht: Jeder Raum wird separat gesteuert.</div></section>""",
  f"""<section class="feature"><h2><span class="n">5</span>Vollbild</h2>
   <p class="lead">Der Spieler-Bildschirm jedes Raums kann im Fenster oder im Vollbild laufen.</p>
   <p>Klicke auf die Schaltfläche <span class="btn">&#9974;</span> oben in der Spalte eines Raums, um dessen <b>Spieler-Fenster</b> in den Vollbildmodus und zurück zu schalten.</p>
   <div class="shot small"><img src="{S['fullscreen']}"></div>
   <div class="cap">Der Vollbild-Schalter befindet sich neben dem Raumnamen.</div></section>""",
  f"""<section class="feature"><h2><span class="n">6</span>Text-Hinweise</h2>
   <p class="lead">Sende einen geschriebenen Hinweis an den Spieler-Bildschirm.</p>
   <ol class="steps"><li>Tippe deinen Hinweis in das Feld <b>"Type a hint..."</b>.</li>
   <li>Klicke auf <span class="btn go">Send</span> (oder drücke <b>Enter</b>), um ihn auf dem Spieler-Bildschirm dieses Raums anzuzeigen.</li>
   <li>Klicke auf <span class="btn">Delete</span>, um den Text-Hinweis zu löschen und das Feld zu leeren.</li></ol>
   <div class="shot"><img src="{S['text-hints']}"></div>
   <div class="cap">Hinweis eingeben und an die Spieler senden.</div></section>""",
  f"""<section class="feature"><h2><span class="n">7</span>Hinweis-Ton</h2>
   <p class="lead">Ein optionaler Ton, der auf dem Spieler-Bildschirm abgespielt wird, wenn du einen Hinweis sendest.</p>
   <ul class="body"><li>Das Kontrollkästchen <b>Hint sound</b> (pro Raum) schaltet diesen Ton ein oder aus.</li>
   <li><span class="btn">&#9654; Test</span> spielt den Ton einmal ab, damit du ihn prüfen kannst.</li></ul>
   <div class="shot small"><img src="{S['hint-sound']}"></div>
   <div class="cap">Hinweis-Ton-Schalter und Test-Taste pro Raum.</div>
   <div class="lock">Welche Tondatei verwendet wird, legst du im passwortgeschützten Manager-Bereich fest.</div></section>""",
  f"""<section class="feature"><h2><span class="n">8</span>Bild-Hinweise</h2>
   <p class="lead">Sende mit einem einzigen Klick ein vorbereitetes Bild an den Spieler-Bildschirm.</p>
   <p>Bild-Hinweise sind in <b>Phasen</b> (Phases) gegliedert; jede Phase enthält <b>Rätsel</b> (Riddles); jedes Rätsel enthält ein oder mehrere <b>Bilder</b>. (Diese Sammlung wird vorab im Manager-Modus angelegt.)</p>
   <ol class="steps"><li>Klicke auf eine <b>Phase</b>, um sie aufzuklappen, dann auf ein <b>Rätsel</b>, um seine Bilder anzuzeigen.</li>
   <li><b>Klicke auf ein Bild</b> - es erscheint sofort auf dem Spieler-Bildschirm, und das gewählte Vorschaubild wird hervorgehoben.</li>
   <li>Klicke auf ein anderes Bild, um zu wechseln; das neue ersetzt das alte.</li></ol>
   <div class="shot tall"><img src="{S['picture-hints']}"></div>
   <div class="cap">Phasen &rarr; Rätsel &rarr; Bilder. Das hervorgehobene Vorschaubild ist live auf dem Bildschirm.</div>
   <table><tr><th>Schaltfläche</th><th>Funktion</th></tr>
   <tr><td><span class="btn">Remove picture</span></td><td>Nimmt das aktuelle Bild vom Spieler-Bildschirm (ein Text-Hinweis bleibt).</td></tr>
   <tr><td><span class="btn warn">Remove all</span></td><td>Löscht den Text-Hinweis und das Bild dieses Raums gleichzeitig.</td></tr></table>
   <div class="tip"><b>Nur Bilder.</b> Bild-Hinweise akzeptieren Standbilder - PNG, JPG, GIF, WEBP, BMP. Es gibt keinen Video-Hinweis; ein <b>animiertes GIF</b> ist die nächstliegende Bewegungs-Option.</div></section>""",
  f"""<section class="feature"><h2><span class="n">9</span>App aktualisieren</h2>
   <p class="lead">ER Timer sucht selbstständig nach Updates. <b>Game Master sollten Updates immer installieren.</b></p>
   <p>Wenn eine neue Version gefunden wird, erscheint ein Meldungsfenster:</p>
   <ol class="steps">
   <li>Ein Dialog sagt <b>"ER Timer vX.Y.Z is available. Download now?"</b> - klicke auf <span class="btn go">Yes, Download</span>.</li>
   <li>Der Download läuft im Hintergrund; eine kleine Leiste unten zeigt den Fortschritt.</li>
   <li>Wenn er fertig ist, sagt ein Dialog <b>"Update downloaded. Restart now to install?"</b> - klicke auf <span class="btn go">Restart Now</span>.</li>
   <li>Die App startet mit der neuen Version neu. Fertig.</li></ol>
   <div class="shot small"><img src="{S['update-status']}"></div>
   <div class="cap">Die Download-Fortschrittsleiste am unteren Rand des Steuerfensters.</div>
   <div class="important"><b>Immer aktualisieren.</b> Wähle <b>Yes, Download</b> und dann so bald wie möglich <b>Restart Now</b> - am besten zwischen zwei Spielen, niemals mitten im Spiel. Wenn du <b>Later</b> wählst, wird das Update automatisch installiert, sobald du die App das nächste Mal schließt.</div></section>""",
  f"""<section class="feature"><h2><span class="n">10</span>Manager-Modus</h2>
   <p class="lead">Die Schaltfläche <span class="btn">&#128274; Manager Mode</span> öffnet einen passwortgeschützten Bereich für die einmalige Einrichtung.</p>
   <div class="shot"><img src="{S['manager']}"></div>
   <div class="cap">Die Einstellungs-Kopfzeile mit dem Manager-Modus-Schloss und dem 2-Räume-Schalter.</div>
   <div class="lock">Alles hinter diesem Passwort wird <b>in diesem Handbuch bewusst nicht behandelt</b> - diese Anleitung betrifft nur die Bedienelemente, die du während eines laufenden Spiels nutzt.</div></section>""",
 ],
}

out_dir = os.path.join(ROOT, 'docs', '_shotgen')
os.makedirs(out_dir, exist_ok=True)
for lang, t in (('en', EN), ('de', DE)):
    html = page_html(lang, t)
    fp = os.path.join(out_dir, f'handbook_{lang}.html')
    open(fp, 'w', encoding='utf-8', newline='\n').write(html)
    print('WROTE', lang, len(html), 'bytes ->', fp)
