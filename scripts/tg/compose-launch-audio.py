"""Original Daily launch score. Standard-library synthesis, no samples or licences."""
import array, json, math, os, random, subprocess, wave
from pathlib import Path
root=Path(os.environ.get('TG_LAUNCH_VOICE_DIR','.tg-artifacts/.launch-promo'));public=Path(os.environ.get('TG_LAUNCH_DIR','public/daily-launch'))
if not public.resolve().is_relative_to(Path('public/daily-launch').resolve()):raise ValueError('Launch output must remain in the launch directory')
if not root.resolve().is_relative_to(Path('.tg-artifacts/.launch-promo').resolve()):raise ValueError('Private voice must remain in the launch cache')
m=json.loads((public/'manifest.json').read_text());duration=m['duration'];rate=24000
random.seed(731);frames=array.array('h');pi=math.pi
chords=[(146.8324,220,261.6256,329.6276),(116.5409,174.6141,220,261.6256),(174.6141,220,261.6256,349.2282),(130.8128,196,261.6256,293.6648)]
pluck=[293.6648,440,523.2511,329.6276,349.2282,440,523.2511,587.3295]
marks=[0.04,.23,.42,m['spokenSeconds']+.45,m['spokenSeconds']+.64,m['spokenSeconds']+.83]
notes=[587.3295,659.2551,880]*2
cuts=[s['start'] for s in m['scenes'][1:]]
for i in range(round(duration*rate)):
 t=i/rate;attack=min(1,t/.65);tail=min(1,max(0,(duration-t)/1.2));fade=attack*tail
 chord=chords[int(t/6.4)%4]
 pad=sum(math.sin(2*pi*f*.5*t+math.sin(t*.14+j)*.025)/(j+2) for j,f in enumerate(chord))*.007
 beat=int(t/.8);age=t-beat*.8
 mallet=(math.sin(2*pi*pluck[beat%8]*age)+.18*math.sin(2*pi*pluck[beat%8]*2.001*age))*math.exp(-age*7)*min(1,age/.007)*.008
 logo=0
 for start,f in zip(marks,notes):
  a=t-start
  if 0<=a<1.4:logo+=(math.sin(2*pi*f*a)+.1*math.sin(2*pi*f*2.003*a))*min(1,a/.012)*math.exp(-a*4.8)*.018
 # A small air accent accompanies the visual cuts; no drums under the voice.
 air=0
 for cut in cuts:
  a=t-cut
  if -.09<a<.18:air+=random.uniform(-1,1)*math.sin(pi*(a+.09)/.27)**2*.002
 value=(pad+mallet+logo+air)*fade
 for channel in [-1,1]:
  stereo=value+channel*math.sin(2*pi*chord[0]*.502*t)*.001*fade
  frames.append(round(max(-.99,min(.99,stereo))*32767))
with wave.open(str(root/'original-score.wav'),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes(frames.tobytes())
subprocess.run(['ffmpeg','-y','-v','error','-i',str(root/'voice.wav'),'-i',str(root/'original-score.wav'),'-filter_complex',
 '[1:a]loudnorm=I=-31:TP=-9:LRA=6[bed];[0:a][bed]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.891251:level=false:latency=true[a]',
 '-map','[a]','-ar','48000','-ac','2',str(public/'audio.wav')],check=True)
(public/'README.txt').write_text('Conclavia Daily · primo video di presentazione. Bozza locale da revisionare.\nCopione e musica originali Conclavia; voce '+m['voice']+'. Grafica e animazione dal kit condiviso. Logo ufficiale fornito dal proprietario; fondali Daily già approvati. Font DM Sans e Instrument Serif: attribuzioni OFL in /daily-studio/. Nessuna pubblicazione o spesa pubblicitaria avviata.\nLa traccia vocale è continua, senza accelerazione temporale; la base sintetizzata non contiene campioni di terzi.\n')
print(json.dumps({'duration':duration,'score':'original synthesis, no samples','voice':'unchanged natural timing','master':'stereo 48 kHz','published':False}))
