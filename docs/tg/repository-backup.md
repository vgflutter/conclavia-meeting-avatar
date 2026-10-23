# Repository e archivio multimediale CDaily

Codice applicativo, configurazione editoriale pubblica, dossier e test sono versionati in questo repository. L’engine condiviso rimane in `../conclavia-avatar-kit`; il sito e il deploy hanno repository distinti.

I video, l’audio e le prove grafiche sono conservati con **Git LFS** secondo `.gitattributes`. Sono inclusi anche gli esperimenti precedenti, per poter ricostruire le scelte e confrontare le versioni. Le copie locali restano file reali; Git conserva puntatori e SHA-256, GitHub conserva i corrispondenti oggetti LFS.

Prima di clonare o ripristinare questo progetto installare Git LFS aggiornato, quindi:

```sh
git lfs install --local
git lfs pull
git lfs fsck
npm ci
```

Per un backup completo sono necessari **sia la cronologia Git sia gli oggetti LFS**. Un archivio ZIP senza gli oggetti non equivale al clone completo. Non usare migrazioni della cronologia o push forzati per aggiungere nuovi video: `git add`, `git commit` e `git push` inviano normalmente anche i nuovi oggetti tramite l’hook LFS.

Build `.next*`, dipendenze, cache Python, `.env*`, configurazione privata `.local`, cache `.tg-artifacts`, stato/log dello scheduler `.daily-agent` e dati Mongo non entrano nel commit. Le esclusioni mantengono questi dati sul computer: il commit del software non è un backup del database, dei take privati o delle autorizzazioni degli account. Ripristinare quelle risorse con le procedure operative dedicate.

La configurazione versionata `config/tg/daily-agent.json` è un piano del prodotto senza segreti. La task locale caricata e l’eventuale task ChatGPT Work appartengono al runtime; usare il [manuale operativo](cdaily-agent-runbook.md) dopo un ripristino. Il push non attiva deploy, produzioni o pubblicazioni social.

Documentazione: [Git LFS](https://git-lfs.com/), [gestione dei file grandi su GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage).
