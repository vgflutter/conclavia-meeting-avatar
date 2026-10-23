# CDaily — intreccio un poco più chiuso

22 ottobre 2026. **Movimento respinto dall'utente; sostituito dalla [sequenza successiva](cdaily-avatar-flow-20261022.md).** L'utente apprezza la direzione e chiede di intrecciare
leggermente di più le dita, chiudendo un poco le mani.

La calibrazione condivisa in `interlace-profile.ts` aumenta moderatamente
la flessione delle falangi; la variazione media misurata sui giunti PIP/DIP
è di circa **3,8°** nella presa. I pollici sono meno sollevati. Le origini
dei polsi si avvicinano di mezza unità di rig complessiva; lo
sfalsamento in profondità si riduce. L'abduzione dell'anulare accompagna
il passaggio, preservando la separazione delle falangi durante l'ingresso.

Sono state scartate sia una variante quasi indistinguibile, sia una più
stretta che violava la regressione dito/dito. Restano invariati raggi,
lunghezze ossee, radici, inerzia e limiti del polso. Nessuna variazione
dei gesti `overlap`, `steeple` o del riposo.

## Prova rapida e verifica

- Laboratorio: `/daily-launch/hand-lab/index.html?pose=interlace`.
- MP4 di sei secondi: `/daily-launch/hand-lab/hands-interlace.mp4`.
- [Fotogramma precedente](../images/daily-launch/avatar-compact-20261022/previous-97.png).
- [Presa più raccolta](../images/daily-launch/avatar-compact-20261022/final-97.png).
- [Distanze dal palmo](../images/daily-launch/avatar-compact-20261022/palm-clearance.json).
- [Continuità e composizione](../images/daily-launch/avatar-compact-20261022/motion-metrics.json).

Controllati 151 campioni della prova breve e 923 fotogrammi del template
della presentazione. Separazione minima fra falange e palmo opposto:
**+1,82** nella prova, **+0,47** nel template completo, con raggi dei
gusci inclusi. Nessun crop o overflow. Viaggio massimo delle articolazioni
delle dita nel template: 14,72 unità per fotogramma, entro le soglie esistenti.

La regressione conserva otto mood, due vitalità, pausa, seek, durate diverse,
lunghezze fisse e tolleranza dito/dito precedente. Nessuna soglia è stata
allentata per far passare la nuova presa.

Questa rifinitura aggiorna il renderer condiviso e la prova breve. Gli MP4
completi della presentazione e della chiusura restano nella revisione
`avatar-palm-20261022`/`avatar-palm-closing-20261022`: vengono conservati
come confronto, senza rigenerare ogni video per una prova di posa.

Il margine artistico principale resta nell'appoggio dei pollici e nel
piccolo assestamento dopo il contatto. I test geometrici non certificano
una naturalezza umana perfetta.

Verifica conclusa: 208 test kit, 82 test Onboarding e 60 regressioni browser
Meeting superati; typecheck, confini delle feature, compatibilità dei consumer
ed entrambe le build superati. Prova breve esportata in 150 fotogrammi,
senza audio o errori. La porta 3107 usa `.next-build-avatar-compact`;
il renderer temporaneo 3110 è stato chiuso. Nessuna chiamata a provider.
