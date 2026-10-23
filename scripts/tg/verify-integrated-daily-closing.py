"""Check the actual composed media, retained speech and word-directed gesture."""
import argparse
import array
import json
import math
from pathlib import Path
import re
import subprocess
import wave

parser=argparse.ArgumentParser()
parser.add_argument('--id',required=True)
args=parser.parse_args()
if not re.fullmatch(r'\d{4}-\d{2}-\d{2}-it-pilot-r[1-9]\d*',args.id):
    raise ValueError('Explicit local pilot revision required')
p=Path('public/daily-launch/editions')/args.id
q=Path('docs/images/daily-launch/editions')/args.id
m=json.loads((p/'manifest.json').read_text())
r=m['closingIntegration']
old=p.parent/r['parentId']
o=json.loads((old/'manifest.json').read_text())
old_closing=next(s['start'] for s in o['scenes'] if s['id']=='chiusura')
def pcm(file):
    with wave.open(str(file)) as stream:
        return stream.getparams(),array.array('h',stream.readframes(stream.getnframes()))
a,x=pcm(old/'audio.wav')
b,y=pcm(p/'audio.wav')
boundary=round(r['start']*b.framerate)
fade=round(.006*b.framerate)
assert a==b and b.nframes/b.framerate==m['duration'] and m['duration'] in [240,300]
assert x[:(boundary-fade)*2]==y[:(boundary-fade)*2]
retained=[w for w in o['words'] if w['start']<old_closing]
assert m['words'][:len(retained)]==retained
assert max(abs(v) for v in y)<32767
assert r['boundaryRms']<.002
assert not any('ci ritroviamo con le prossime notizie' in c['text'] for c in m['cues'])
assert m['cues'][-3]['intent']=='point-down'
assert abs(r['commentsAt']-r['pointerApexAt'])<.04
assert all(a['end']<=b['start']+.001 for a,b in zip(m['cues'],m['cues'][1:]))
def decode(file,rate):
    # Average stereo explicitly: the default mono downmix adds 3 dB for dual
    # mono and is unsuitable for judging full-scale sample peaks.
    return array.array('f',subprocess.check_output(['ffmpeg','-v','error','-i',str(file),
        '-map','0:a:0','-af','pan=mono|c0=0.5*c0+0.5*c1','-ar',str(rate),'-f','f32le','pipe:1']))
master=decode(p/'audio.wav',8000)
energy=sum(v*v for v in master)
checks=[]
for fmt in ['portrait','landscape']:
    audio=decode(p/(fmt+'.mp4'),8000)
    assert len(audio)==len(master)
    corr=sum(a*b for a,b in zip(master,audio))/math.sqrt(energy*sum(v*v for v in audio))
    assert corr>.995
    native=decode(p/(fmt+'.mp4'),48000)
    peak=max(abs(v) for v in native)
    assert peak<.98
    stats={}
    for label,t in [('originalRepairedJoin',14.829375),('closingJoin',r['start'])]:
        i=round(t*48000)
        stats[label]={'jump':abs(native[i]-native[i-1]),'localPeak':max(abs(v) for v in native[i-240:i+240])}
    assert stats['closingJoin']['localPeak']<.02
    checks.append({'format':fmt,'masterCorrelation':corr,'nativeRate':48000,
                   'decodedStereoAveragePeak':peak,'boundaryChecks':stats})
    for name,t in [('join-before',r['start']-.24),('join-after',r['start']+.28),
                   ('comments',r['commentsAt']+.20),('release',r['start']+2.24),
                   ('invite',r['start']+3.44),('signature',m['duration']-1.6)]:
        subprocess.run(['ffmpeg','-y','-v','error','-ss',str(t),'-i',str(p/(fmt+'.mp4')),
            '-frames:v','1','-q:v','2',str(q/(fmt+'-'+name+'.jpg'))],check=True)
    subprocess.run(['ffmpeg','-y','-v','error','-ss',str(r['start']+.20),'-i',str(p/(fmt+'.mp4')),
        '-t','2.08','-vf',('fps=12.5,scale=216:384,tile=7x4' if fmt=='portrait' else 'fps=12.5,scale=480:270,tile=7x4'),
        '-frames:v','1','-q:v','2',str(q/(fmt+'-gesture-contact.jpg'))],check=True)
proof={'id':m['id'],'mediaVersion':m['mediaVersion'],'duration':m['duration'],
       'bodyPcmUnchangedUntil':r['start']-.006,'bodyWordsUnchanged':True,
       'pointDownAt':r['pointerApexAt'],'commentsAt':r['commentsAt'],
       'oldClosingRemoved':True,'cueClockOrdered':True,'noClippingInMaster':True,
       'speechSpeedChanged':False,'closingGainDb':r['closingGainDb'],'audio':checks,
       'extractedFrames':12,'gestureContactFramesPerFormat':26,'providerCalls':0,
       'previewOnly':True,'editorialBodyStillPending':True}
(q/'final-media-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof,indent=2))
