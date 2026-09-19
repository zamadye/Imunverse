#!/usr/bin/env python3
"""Pose-shot: bekuukan SATU pose animasi RML menjadi varian debug.

Cara kerja: salin proyek ke build/dbg-pose/<nama>/, tulis ulang animasi
target agar pose pada frame K menjadi frame 0 (kunci < K dibuang, sisanya
digeser), arahkan Entry ke state itu, lalu --screenshot menangkapnya
(tangkapan selalu mendarat di awal state).

Pakai: python3 tools/rive-pose.py <anim> <frameK> [<stateId>]
  stateId bawaan dipetakan dari nama anim (lapisan Main/Equip).
Contoh: python3 tools/rive-pose.py walk 5
"""
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TB = os.path.join(ROOT, 'assets', 'character-anim-src', 'tbolt')
STATE = {'idle': 605, 'walk': 606, 'attack': 607, 'skill_lockon': 608,
         'skill_execute': 609, 'hit': 610, 'death': 611, 'vfxPulse': 612,
         'equip0': 644, 'equip1': 645, 'equip2': 646, 'equip3': 647,
         'equipDeath': 648}


def main():
    anim = sys.argv[1]
    at = int(sys.argv[2])
    state = int(sys.argv[3]) if len(sys.argv) > 3 else STATE[anim]
    tag = f'{anim}-f{at}'
    d = os.path.join(TB, 'build', 'dbg-pose', tag)
    if os.path.exists(d):
        shutil.rmtree(d)
    os.makedirs(d)
    shutil.copy(os.path.join(TB, 'scene.rml'), os.path.join(d, 'scene.rml'))
    shutil.copy(os.path.join(TB, 'rive.yaml'), os.path.join(d, 'rive.yaml'))
    parts = os.path.join(d, 'parts')
    if os.path.islink(parts) or os.path.exists(parts):
        os.remove(parts)
    os.symlink('../../../parts', parts)
    p = os.path.join(d, 'scene.rml')
    s = open(p).read()

    def rebase(m):
        head, body = m.group(1), m.group(2)
        dur = int(re.search(r'duration="(\d+)"', head).group(1))
        keep = []
        for km in re.finditer(r'<KeyFrameDouble value="([^"]+)" frame="(\d+)"([^/]*)/>', body):
            f = int(km.group(2))
            if f >= at:
                keep.append((f - at, km.group(1), km.group(3)))
        if not keep:
            return m.group(0)
        mx = max(f for f, _, _ in keep)
        newdur = max(mx, 1)
        head2 = re.sub(r'duration="\d+"', f'duration="{newdur}"', head)
        head2 = re.sub(r'loopValue="oneShot"', 'loopValue="loop"', head2)
        nb = body
        for (f0, v, extra) in keep:
            pass
        # tulis ulang kunci satu per satu (ganti kemunculan berurutan)
        out = []
        idx = 0
        for km in re.finditer(r'<KeyFrameDouble value="([^"]+)" frame="(\d+)"([^/]*)/>', body):
            f = int(km.group(2))
            if f < at:
                continue
            out.append((km.start(), km.end(),
                        f'<KeyFrameDouble value="{km.group(1)}" frame="{f - at}"{km.group(3)}/>'))
        parts_o = []
        last = 0
        for a, b, rep in out:
            parts_o.append(body[last:a])
            parts_o.append(rep)
            last = b
        # buang kunci f<at: dhilangkan dengan mengosongkan rentangnya
        skipped = [(km.start(), km.end()) for km in
                   re.finditer(r'<KeyFrameDouble value="[^"]+" frame="(\d+)"[^/]*/>', body)
                   if int(km.group(1)) < at]
        body2 = body
        for a, b in sorted(skipped, reverse=True):
            body2 = body2[:a] + body2[b:]
        # terapkan pergeseran pada sisanya
        def sh(m2):
            return f'<KeyFrameDouble value="{m2.group(1)}" frame="{int(m2.group(2)) - at}"{m2.group(3)}/>'
        body2 = re.sub(r'<KeyFrameDouble value="([^"]+)" frame="(\d+)"([^/]*)/>', sh, body2)
        return head2 + body2 + '</LinearAnimation>'
    pat = re.compile(r'(<LinearAnimation [^>]*name="%s"[^>]*>)(.*?)</LinearAnimation>' % re.escape(anim), re.S)
    s2, n = pat.subn(rebase, s, count=1)
    assert n == 1, 'anim tidak ketemu: ' + anim
    # Entry HANYA di lapisan pemilik state (lintas-lapisan merusak impor)
    if state >= 644:
        s2 = re.sub(r'(<EntryState x="0" y="300" id="0:643">\s*<StateTransition stateToId=")0:644(")',
                    rf'\g<1>0:{state}\g<2>', s2, count=1)
    else:
        s2 = re.sub(r'(<EntryState x="0" y="120" id="0:604">\s*<StateTransition stateToId=")0:605(")',
                    rf'\g<1>0:{state}\g<2>', s2, count=1)
    # Kunci state target: buang SEMUA transisi keluarnya agar pose tidak kabur
    # (mis. lapisan Equip: stage bawaan 0 membuat equip2/equip3 cascade ke
    # equip0 saat screenshot; transisi keluar hanya artefak debug, bukan rig).
    def lock_state(m):
        head, body = m.group(1), m.group(2)
        body2 = re.sub(r'<StateTransition\b[^>]*(?:/>|>.*?</StateTransition>)',
                       '', body, flags=re.S)
        return head + body2 + '</AnimationState>'
    pat_st = re.compile(
        r'(<AnimationState\b[^>]*id="0:%d"[^>]*>)(.*?)</AnimationState>' % state, re.S)
    s2, n_st = pat_st.subn(lock_state, s2, count=1)
    assert n_st == 1, 'state tidak ketemu: ' + str(state)
    open(p, 'w').write(s2)
    shot = os.path.join(d, 'shot.png')
    r = subprocess.run(['node', 'tools/rive/run.mjs', d,
                        f'--screenshot={shot}', '--advance=100ms'],
                       cwd=ROOT, capture_output=True, text=True)
    ok = os.path.exists(shot)
    print(('OK ' if ok else 'GAGAL ') + tag)
    if not ok:
        print(r.stdout[-600:] + r.stderr[-600:])
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
