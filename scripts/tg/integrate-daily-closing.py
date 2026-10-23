"""Integrate the approved recorded closing into a new local Daily pilot.

Uses existing encoded artwork and measured word anchors. No TTS, ASR, DB,
publication or changes to the original candidate. News remains a dated pilot.
"""
import argparse
import array
import copy
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import wave

parser = argparse.ArgumentParser()
parser.add_argument('--from-id', required=True)
parser.add_argument('--to-id', required=True)
parser.add_argument('--closing', required=True)
args = parser.parse_args()
for value in [args.from_id, args.to_id]:
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}-it-pilot-r[1-9]\d*', value):
        raise ValueError('Explicit local pilot revision required')
if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', args.closing):
    raise ValueError('Named closing revision required')
if args.from_id[:10] != args.to_id[:10]:
    raise ValueError('A technical revision must preserve the edition date')
root = Path.cwd()
parent = root / 'public/daily-launch/editions' / args.from_id
out = parent.parent / args.to_id
closing = root / 'public/daily-launch/revisions' / args.closing
qa = root / 'docs/images/daily-launch/editions' / args.to_id
if out.exists() or qa.exists() or args.from_id == args.to_id:
    raise ValueError('Preserve existing revisions; no overwrite')
m = json.loads((parent / 'manifest.json').read_text())
c = json.loads((closing / 'manifest.json').read_text())
if (m.get('id') != args.from_id or m.get('kind') != 'daily-pilot'
        or not m.get('previewOnly') or m.get('duration') not in [240, 300]
        or not c.get('previewOnly') or len(c.get('cues', [])) != 3):
    raise ValueError('Expected reviewed local pilot and three-part closing')
if not c.get('voice') or c['voice'] not in m.get('voice',''):
    raise ValueError('The closing must use the same approved presenter voice')
expected = 'Scrivici nei commenti cosa vuoi approfondire: partiamo dalle tue domande. Meno rumore, più contesto.'
if ' '.join(x['text'] for x in c['cues']) != expected:
    raise ValueError('Closing copy needs explicit review')
pointer = c['cues'][0]
if pointer.get('intent') != 'point-down' or pointer.get('gestureWord') != 'commenti':
    raise ValueError('Missing word-directed downward pointer')
stroke = pointer['choreography']['strokes'][0]
comment = next(w for w in c['words'] if w['text'].lower() == 'commenti')
if stroke['kind'] != 'point-down' or abs(pointer['start'] + stroke['apex'] - comment['start']) > .04:
    raise ValueError('Pointer does not match measured comments word')
old_closing = next(s for s in m['scenes'] if s['id'] == 'chiusura')
fps = 25
duration = m['duration']
body_words = [w for w in m['words'] if w['start'] < old_closing['start']]

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def run(*command):
    return subprocess.check_output(command, stderr=subprocess.PIPE).decode().strip()

def read_pcm(file):
    with wave.open(str(file)) as stream:
        p = stream.getparams()
        if p.nchannels != 2 or p.sampwidth != 2 or p.framerate != 48000 or p.comptype != 'NONE':
            raise ValueError('Expected 48 kHz stereo PCM16 master')
        return p, array.array('h', stream.readframes(p.nframes))

def active_rms(pcm, start, end, rate=48000):
    start, end, block = round(start * rate) * 2, round(end * rate) * 2, round(.02 * rate) * 2
    energies = [sum((v / 32768) ** 2 for v in pcm[i:min(i+block, end)]) / min(block, end-i)
                for i in range(start, end, block)]
    active = [v for v in energies if v > 1e-5]
    if not active:
        raise ValueError('Missing audible speech in gain comparison')
    return math.sqrt(sum(active) / len(active))

p, original = read_pcm(parent / 'audio.wav')
cp, close_pcm = read_pcm(closing / 'audio.wav')
if abs(cp.nframes / cp.framerate - c['duration']) > .001:
    raise ValueError('Closing master clock mismatch')
# ASR is approximate: the old "Per" starts before its word anchor. Find a
# quiet frame boundary after the last retained word, before that old onset.
candidates = range(math.ceil((body_words[-1]['end']+.08)*fps), math.floor((old_closing['start']-.04)*fps)+1)
def boundary_energy(frame):
    index=round(frame/fps*p.framerate)*2
    window=round(.006*p.framerate)*2
    values=original[index-window:index+window]
    return sum((v/32768)**2 for v in values)/len(values)
if not candidates:
    raise ValueError('No frame-aligned pause before the old closing')
frame=min(candidates,key=lambda f:(boundary_energy(f),-f))
cut=frame/fps
if boundary_energy(frame)>.000004:
    raise ValueError('No sufficiently quiet PCM boundary; review the edit')
pad = round(duration - cut - c['duration'], 6)
if not 0 <= pad <= 3:
    raise ValueError('The existing closing must fit without changing speech speed')
gain = active_rms(original, max(0, cut-10), cut) / active_rms(close_pcm, .18, c['cues'][-1]['end'])
peak = max(abs(x) / 32768 for x in close_pcm)
if not .65 <= gain <= 1.6 or gain * peak > .88:
    raise ValueError('Closing loudness needs a dedicated mix review')
boundary = round(cut * p.framerate)
prefix = original[:boundary * 2]
tail = array.array('h', (round(v * gain) for v in close_pcm))
fade = round(.006 * p.framerate)
for i in range(fade):
    a = .5 * (1 + math.cos(math.pi * (i+1) / fade))
    b = .5 * (1 - math.cos(math.pi * i / (fade-1)))
    for channel in range(2):
        j = (boundary-fade+i)*2+channel
        prefix[j] = round(prefix[j] * a)
        tail[i*2+channel] = round(tail[i*2+channel] * b)
combined = prefix + tail
combined.extend([0] * (round(duration*p.framerate)*2-len(combined)))
if len(combined) != p.nframes*2 or combined[:(boundary-fade)*2] != original[:(boundary-fade)*2]:
    raise ValueError('Unexpected body audio or duration change')
out.mkdir()
qa.mkdir(parents=True)
with wave.open(str(out / 'audio.wav'), 'wb') as stream:
    stream.setparams(p)
    stream.writeframes(combined.tobytes())

body_cues = [copy.deepcopy(x) for x in m['cues'] if x['scene'] != 'chiusura']
body_cues[-1]['end'] = min(body_cues[-1]['end'], cut)
close_cues = copy.deepcopy(c['cues'])
for cue in close_cues:
    cue.update(scene='chiusura', start=cue['start']+cut, end=cue['end']+cut)
body_scenes = [copy.deepcopy(s) for s in m['scenes'] if s['id'] != 'chiusura']
body_scenes[-1]['end'] = cut
close_scenes = copy.deepcopy(c['scenes'])
for s in close_scenes:
    s.update(id='chiusura' if s['kind'] == 'host' else 'firma-finale', start=s['start']+cut, end=s['end']+cut)
close_scenes[-1]['end'] = duration
lines = [copy.deepcopy(x) for x in m['lines'] if x['scene'] != 'chiusura']
lines.extend({k:v for k,v in cue.items() if k in ['text','scene','mood','intensity','intent','sourceIds','gestureWord']} for cue in close_cues)
report = {'parentId':args.from_id, 'id':args.to_id, 'closingRevision':args.closing,
          'closingMediaVersion':c['mediaVersion'], 'closingSourceSha256':c['sourceSha256'],
          'bodyMasterSha256':sha(parent/'audio.wav'), 'closingMasterSha256':sha(closing/'audio.wav'),
          'start':cut, 'commentsAt':cut+comment['start'], 'pointerApexAt':cut+pointer['start']+stroke['apex'],
          'boundarySelection':'quiet PCM window after retained word, before approximate ASR closing anchor',
          'boundaryRms':math.sqrt(boundary_energy(frame)),
          'closingGain':gain, 'closingGainDb':20*math.log10(gain), 'closingPeakAfterGain':gain*peak,
          'pauseBeforeClosing':cut+c['cues'][0]['start']-body_words[-1]['end'],
          'frameRate':fps, 'duration':duration, 'finalHoldAddedSeconds':pad,
          'bodyPcmUnchangedBeforeSeconds':cut-.006, 'bodyWordsUnchanged':True,
          'originalSpliceRepairPreserved':True, 'speechSpeedChanged':False,
          'providerCalls':0, 'musicAdded':False, 'previewOnly':True,
          'newsSelectionStillNeedsRevision':True, 'videos':{}}
m.update(id=args.to_id, revision=int(args.to_id.rsplit('-r',1)[-1]),
         cues=body_cues+close_cues, scenes=body_scenes+close_scenes, lines=lines,
         words=body_words+[dict(w,start=w['start']+cut,end=w['end']+cut) for w in c['words']],
         cta=c['cta'], spokenSeconds=cut+c['spokenSeconds'],
         wordTimingSource='cached-measured-word-anchors-composed-clock', closingIntegration=report)
for fmt in ['portrait','landscape']:
    target = out / (fmt+'.mp4')
    # Existing approved frames, not a new renderer or altered art direction.
    # The new closing has a natural scene entry; the final signature holds silently.
    filters = f'[0:v]trim=end={cut:.6f},setpts=PTS-STARTPTS,setsar=1[a];[1:v]setpts=PTS-STARTPTS,setsar=1,tpad=stop_mode=clone:stop_duration={pad:.6f}[b];[a][b]concat=n=2:v=1:a=0[v]'
    run('ffmpeg','-v','error','-i',str(parent/(fmt+'.mp4')),'-i',str(closing/(fmt+'.mp4')),
        '-i',str(out/'audio.wav'),'-filter_complex',filters,'-map','[v]','-map','2:a:0',
        '-c:v','libx264','-preset','fast','-crf','18','-threads','4','-pix_fmt','yuv420p',
        '-r','25','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t',str(duration),
        '-movflags','+faststart',str(target))
    run('ffmpeg','-v','error','-i',str(target),'-f','null','-')
    probe=json.loads(run('ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate,sample_aspect_ratio','-of','json',str(target)))
    if abs(float(probe['format']['duration'])-duration)>.001:
        raise ValueError('Video duration changed')
    report['videos'][fmt]={'sha256':sha(target),'probe':probe,'fullDecode':'passed'}
    shutil.copyfile(parent/('cover-'+fmt+'.jpg'),out/('cover-'+fmt+'.jpg'))
    print(json.dumps({'format':fmt,'state':'integrated','seconds':duration}),flush=True)

def stamp(t):
    ms=round(t*1000)
    return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d}.{ms%1000:03d}'

(out/'captions.vtt').write_text('WEBVTT\n\n'+'\n'.join(f'{i+1}\n{stamp(x["start"])} --> {stamp(x["end"])}\n{x["text"]}\n' for i,x in enumerate(m['cues'])))
(out/'script.txt').write_text('\n\n'.join(x['text'] for x in m['cues'])+'\n')
shutil.copyfile(parent/'caption.txt',out/'caption.txt')
m['mediaVersion']=hashlib.sha256(''.join(report['videos'][fmt]['sha256'] for fmt in ['portrait','landscape']).encode()).hexdigest()[:12]
(out/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
(qa/'closing-integration.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'id':args.to_id,'mediaVersion':m['mediaVersion'],'start':cut,'commentsAt':report['commentsAt'],'closingGainDb':report['closingGainDb'],'providerCalls':0}),flush=True)
