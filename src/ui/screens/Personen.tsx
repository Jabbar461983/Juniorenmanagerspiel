import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FAKTOR_NAMEN,
  ROLLEN_NAMEN,
  SKILL_NAMEN,
  SKILLS,
  alter,
  elternTyp,
  kindZug,
  name,
  stimmungAus,
  talentEinschaetzung,
  teamsVonTrainer,
  trainerZug,
  jahresbeitrag,
  haertefallAktiv,
  type Elternteil,
  type GameState,
  type Kind,
  type Person,
  type Trainer
} from '../../engine';
import { Badge, Balken, Karte } from '../components/Basis';
import { Portrait } from '../components/Portrait';
import type { SpielApi } from '../useSpiel';

type Filter = 'kinder' | 'trainer' | 'eltern' | 'ehemalige';

const QUALI: Record<Trainer['qualifikation'], string> = {
  keine: 'keine J+S-Anerkennung',
  leiter: 'J+S-Leiter:in',
  leiterWeiterbildung: 'J+S-Leiter:in mit Weiterbildung',
  experte: 'J+S-Expert:in'
};

const KIND_WERTE: { id: keyof Kind['werte']; name: string }[] = [
  { id: 'technik', name: 'Technik' },
  { id: 'kondition', name: 'Kondition' },
  { id: 'spielverstaendnis', name: 'Spielverständnis' },
  { id: 'motivation', name: 'Motivation' },
  { id: 'sozialverhalten', name: 'Sozialverhalten' },
  { id: 'selbstvertrauen', name: 'Selbstvertrauen' },
  { id: 'fairplay', name: 'Fairplay' }
];

function zugName(p: Person, id: string): string {
  if (p.rolle === 'kind') return kindZug(id)?.name ?? id;
  if (p.rolle === 'trainer') return trainerZug(id)?.name ?? id;
  return id.replace(/_/g, ' ');
}

function stimmungVon(p: Person): number | undefined {
  if (p.rolle === 'kind') return p.zufriedenheit;
  if (p.rolle === 'elternteil') return p.stimmung;
  return undefined;
}

function untertitel(s: GameState, p: Person): string {
  const a = alter(s, p);
  if (p.rolle === 'kind') return `${a} J. · ${p.teamId ? (s.teams[p.teamId]?.name ?? '–') : 'kein Team'}${p.status === 'schnupper' ? ' · Schnupper' : ''}`;
  if (p.rolle === 'trainer') {
    const teams = teamsVonTrainer(s, p.id).map((t) => t.name);
    return `${a} J. · ${teams.length ? teams.join(', ') : 'ohne Team'}`;
  }
  return `${a} J. · ${elternTyp(p.typ).name}`;
}

function Detail({ s, p, schliessen, zeige }: { s: GameState; p: Person; schliessen: () => void; zeige: (id: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
  }, [p.id]);
  const z = stimmungVon(p);
  const familie = p.rolle === 'kind' || p.rolle === 'elternteil' ? s.familien[p.familieId] : undefined;
  const verwandte = familie ? [...familie.elternIds.map((id) => s.eltern[id]), ...familie.kinderIds.map((id) => s.kinder[id])].filter((x): x is Elternteil | Kind => !!x && x.id !== p.id) : [];

  return (
    <dialog ref={ref} className="detail" onClose={schliessen} aria-labelledby="detail-titel">
      <div className="detail-kopf">
        <Portrait meta={p.portrait} personId={p.id} vorname={p.vorname} nachname={p.nachname} stimmung={z !== undefined ? stimmungAus(z) : undefined} groesse={88} />
        <div>
          <h2 id="detail-titel">{name(p)}</h2>
          <p className="klein">{untertitel(s, p)}</p>
          <div className="zeile">
            {p.charakterzuege.map((c) => (
              <Badge key={c}>{zugName(p, c)}</Badge>
            ))}
          </div>
        </div>
        <button className="knopf klein schliessen" onClick={() => ref.current?.close()} aria-label="Schliessen">
          ✕
        </button>
      </div>

      {p.rolle === 'kind' && (
        <>
          <Balken label="Zufriedenheit" wert={p.zufriedenheit} ton="auto" />
          <h3>Faktoren (Zielwerte)</h3>
          {(Object.keys(FAKTOR_NAMEN) as (keyof typeof FAKTOR_NAMEN)[]).map((f) => (
            <Balken key={f} label={FAKTOR_NAMEN[f]} wert={p.faktoren[f]} ton="auto" />
          ))}
          <h3>Werte</h3>
          {KIND_WERTE.map((w) => (
            <Balken key={w.id} label={w.name} wert={p.werte[w.id]} max={20} />
          ))}
          <p className="klein">
            Talent: {talentEinschaetzung(s, p) ? `Einschätzung des Trainerteams: ${talentEinschaetzung(s, p)}` : 'verborgen (erfahrene Trainer:innen können es einschätzen)'}
            {' · '}Einsatzzeit {Math.round(p.einsatzzeit * 100)} % · Beitrag CHF {Math.round(jahresbeitrag(s, p))}/Jahr
            {familie && haertefallAktiv(s, familie) && ' (Härtefall)'}
          </p>
          {p.austritt && <p className="hinweis warn">Ausgetreten: {p.austritt.grund} (Saison {p.austritt.saison}, Woche {p.austritt.woche})</p>}
        </>
      )}

      {p.rolle === 'trainer' && (
        <>
          <Balken label="Belastung" wert={p.belastung} />
          <Balken label="Motivation" wert={p.motivation} max={20} />
          <h3>Fähigkeiten</h3>
          {SKILLS.map((sk) => (
            <Balken key={sk} label={SKILL_NAMEN[sk]} wert={p.skills[sk]} max={20} />
          ))}
          <p className="klein">
            {QUALI[p.qualifikation]} · verfügbar für {p.verfuegbarkeit} Training{p.verfuegbarkeit === 1 ? '' : 's'} pro Woche · Quelle: {p.quelle}
          </p>
          <ul className="klein">
            {teamsVonTrainer(s, p.id).map((t) => (
              <li key={t.id}>
                {t.name}: {ROLLEN_NAMEN[t.trainer.find((x) => x.trainerId === p.id)!.rolle]}
              </li>
            ))}
          </ul>
          {p.status !== 'aktiv' && <p className="hinweis warn">Zurückgetreten.</p>}
        </>
      )}

      {p.rolle === 'elternteil' && (
        <>
          <Balken label="Stimmung gegenüber dem Verein" wert={p.stimmung} ton="auto" />
          <p>{elternTyp(p.typ).beschreibung}</p>
          <Balken label="Engagement" wert={p.engagement} max={20} />
          <Balken label="Konfliktbereitschaft" wert={p.konfliktbereitschaft} max={20} />
          <Balken label="Zahlungsmoral" wert={p.zahlungsmoral} max={20} />
          <Balken label="Einfluss im Verein" wert={p.einfluss} max={20} />
          {familie && <p className="klein">Einkommen der Familie: {familie.einkommen}</p>}
        </>
      )}

      {verwandte.length > 0 && (
        <>
          <h3>Familie</h3>
          <ul className="zeile">
            {verwandte.map((v) => (
              <li key={v.id}>
                <button className="link" onClick={() => zeige(v.id)}>
                  {name(v)} ({v.rolle === 'kind' ? 'Kind' : 'Elternteil'})
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </dialog>
  );
}

export function Personen({ spiel }: { spiel: SpielApi }) {
  const s = spiel.ansicht!;
  const [filter, setFilter] = useState<Filter>('kinder');
  const [suche, setSuche] = useState('');
  const [auswahl, setAuswahl] = useState<string | null>(null);

  const liste = useMemo(() => {
    let personen: Person[];
    if (filter === 'kinder') personen = Object.values(s.kinder).filter((k) => k.status !== 'ausgetreten');
    else if (filter === 'trainer') personen = Object.values(s.trainer).filter((t) => t.status === 'aktiv');
    else if (filter === 'ehemalige') personen = [...Object.values(s.kinder).filter((k) => k.status === 'ausgetreten'), ...Object.values(s.trainer).filter((t) => t.status !== 'aktiv')];
    else {
      const aktiveFam = new Set(Object.values(s.kinder).filter((k) => k.status !== 'ausgetreten').map((k) => k.familieId));
      personen = Object.values(s.eltern).filter((e) => aktiveFam.has(e.familieId));
    }
    const q = suche.trim().toLowerCase();
    if (q) personen = personen.filter((p) => name(p).toLowerCase().includes(q));
    return personen.sort((a, b) => a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname));
  }, [s, filter, suche]);

  const person = auswahl ? (s.kinder[auswahl] ?? s.trainer[auswahl] ?? s.eltern[auswahl]) : undefined;

  return (
    <div className="stapel">
      <Karte>
        <div className="werkzeugleiste">
          <div className="segment" role="group" aria-label="Personengruppe">
            {(
              [
                ['kinder', 'Kinder'],
                ['trainer', 'Trainer:innen'],
                ['eltern', 'Eltern'],
                ['ehemalige', 'Ehemalige']
              ] as [Filter, string][]
            ).map(([id, label]) => (
              <button key={id} className={filter === id ? 'aktiv' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          <label className="suche">
            <span className="sr-only">Suchen</span>
            <input type="search" placeholder="Name suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
          </label>
        </div>
        <p className="klein">{liste.length} Personen</p>
        <ul className="kartenraster">
          {liste.map((p) => {
            const z = stimmungVon(p);
            return (
              <li key={p.id}>
                <button className="personenkarte" onClick={() => setAuswahl(p.id)}>
                  <Portrait meta={p.portrait} personId={p.id} vorname={p.vorname} nachname={p.nachname} stimmung={z !== undefined ? stimmungAus(z) : undefined} />
                  <span className="personenkarte-text">
                    <strong>{name(p)}</strong>
                    <span className="klein">{untertitel(s, p)}</span>
                    {p.rolle === 'kind' && <span className="klein">Zufriedenheit {Math.round(p.zufriedenheit)}</span>}
                    {p.rolle === 'trainer' && <span className="klein">Belastung {Math.round(p.belastung)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Karte>
      {person && <Detail key={person.id} s={s} p={person} schliessen={() => setAuswahl(null)} zeige={setAuswahl} />}
    </div>
  );
}
