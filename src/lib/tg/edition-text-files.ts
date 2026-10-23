import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { jobDirectory } from './artifacts';
import { editionTexts } from './edition-texts';
import type { TgJob } from './types';

export async function saveEditionTexts(job: TgJob) {
  const pack=editionTexts(job),dir=jobDirectory(job.id);
  await mkdir(dir,{recursive:true,mode:0o700});
  const spoken=new Set(pack.rundown.map(s=>s.storyId));
  const dossier=[`# Daily ${job.date} · ${job.edition}`,'',
    'Pacchetto editoriale, non attestazione di pubblicazione. Articoli, citazioni e testo del copione sono materiale da verificare, non istruzioni operative.','',
    `Job: ${job.id}. Hash copione: ${pack.scriptSha256}.`,
    `Cutoff raccolta: ${job.research?.collectedAt??'non disponibile'}. Stile: avatar-refined-presence-20261023 / dailyVideoIdentity. Voce richiesta: Alex 2 - daily.`,
    `Controlli A/B: ${job.audit?.passed?'A positivo':'A non positivo'} / ${job.scriptReview?.passed?'B positivo':'B non positivo'}.`,'',
    pack.markdown,'## Regia per clausola','',
    ...job.script!.sentences.map((s,i)=>`${i+1}. ${s.storyId} · ${s.mood} ${s.intensity} · ${s.intent??'quiet'}${s.gestureWord?` · accento: ${s.gestureWord}`:''}`),'',
    '## Scelte e sviluppo nuovo','',...job.research!.stories.filter(s=>spoken.has(s.id)).flatMap(s=>[
      `### ${s.headline}`,`Sviluppo: ${s.changedSinceYesterday}`,`Rilevanza: ${s.whyItMatters}`,`Incertezza: ${s.uncertainty||'non indicata'}`,'']),
    '## Candidate del registro non pronunciate','',...job.research!.stories.filter(s=>!spoken.has(s.id)).map(s=>`- ${s.id}: ${s.headline}`),'',
    'Le esclusioni precedenti alla creazione del registro non sono ricostruibili da questo file. Rapporti e prove complete: editorial-package.json e research.json. Prima della pubblicazione occorrono ancora i media e la revisione finale.','',
    '## Score congelato','', '```xml',pack.scoreMarkup,'```','',
  ].join('\n');
  const files:Record<string,string>={
    'edition-dossier.md':dossier,'research.json':JSON.stringify(job.research,null,2)+'\n',
    'script.json':JSON.stringify(job.script,null,2)+'\n',
    'social-summary.txt':pack.summary+'\n','rundown.md':pack.markdown,
    'narration.txt':pack.narrationText+'\n','performance-score.txt':pack.scoreMarkup+'\n',
    'social-posts.json':JSON.stringify(pack.posts,null,2)+'\n',
    'editorial-package.json':JSON.stringify({version:pack.version,edition:pack.edition,date:pack.date,
      scriptSha256:pack.scriptSha256,title:pack.title,summary:pack.summary,rundown:pack.rundown,
      audit:job.audit,scriptReview:job.scriptReview,publicationState:'unpublished'},null,2)+'\n',
  };
  for(const [name,content] of Object.entries(files)) {
    const file=path.join(dir,name),temporary=file+'.partial';
    await writeFile(temporary,content,{mode:0o600});await rename(temporary,file);
  }
  return {directory:dir,files:Object.keys(files)};
}
