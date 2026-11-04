import { useState } from 'react';
import {
  ANWERBUNG,
  B,
  KATEGORIE_NAMEN,
  STUFEN,
  aktiveKinder,
  beitraegeAenderbar,
  chf,
  jahresbeitrag,
  AKTIVITAETEN,
  GEGENLEISTUNG_NAMEN,
  aktivitaetMoeglich,
  helferPool,
  type Buchung,
  type Niveau,
  type Stufe
} from '../../engine';
import { Badge, Karte } from '../components/Basis';
import type { SpielApi } from '../useSpiel';

const NIVEAUS: { id: Niveau; name: string }[] = [
  { id: 'tief', name: 'tief' },
  { id: 'mittel', name: 'mittel' },
  { id: 'hoch', name: 'hoch' }
];

function summen(buchungen: Buchung[]): [Buchung['kategorie'], number][] {
  const m = new Map<Buchung['kategorie'], number>();
  for (const b of buchungen) m.set(b.kategorie, (m.get(b.kategorie) ?? 0) + b.betrag);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function Finanzen({ spiel }: { spiel: SpielApi }) {
  const s = spiel.ansicht!;
  const f = s.finanzen;
  const aenderbar = beitraegeAenderbar(spiel.stand!.state);
  const [zielStufe, setZielStufe] = useState<Stufe>('U9');
  const saisonBuchungen = spiel.stand!.state.finanzen.buchungen.filter((b) => b.saison === s.saison);
  const letzteWoche = saisonBuchungen.filter((b) => b.woche === s.woche - 1);
  const geplant = spiel.stand!.entwurf.map((e, i) => ({ e, i })).filter((x) => x.e.typ === 'anwerbung');
  const jahresertrag = aktiveKinder(s).reduce((a, k) => a + jahresbeitrag(s, k), 0);

  return (
    <div className="stapel">
      <div className="kennzahlen">
        <div className={`kennzahl ${f.kasse < 0 ? 'ton-schlecht' : ''}`}>
          <div className="kennzahl-label">Kasse</div>
          <div className="kennzahl-wert">{chf(f.kasse)}</div>
          {f.wochenUnterNull > 0 && <div className="kennzahl-zusatz">seit {f.wochenUnterNull} Wochen im Minus</div>}
        </div>
        <div className="kennzahl">
          <div className="kennzahl-label">Beiträge pro Jahr (aktuell)</div>
          <div className="kennzahl-wert">{chf(jahresertrag)}</div>
        </div>
        <div className="kennzahl">
          <div className="kennzahl-label">Saisonergebnis bisher</div>
          <div className="kennzahl-wert">{chf(saisonBuchungen.reduce((a, b) => a + b.betrag, 0))}</div>
        </div>
      </div>

      <Karte titel="Jahresbudget und Sponsoren">
        <p>
          Jahresbudget aus dem Gesamtverein für die nächste Saison:{' '}
          <strong>{s.vorstand.gv.some((g) => g.saison === s.saison) ? chf(s.vorstand.jahresbudget) : 'noch offen'}</strong>{' '}
          <span className="klein">(beschliesst die GV im Mai, abhängig von deinem Einfluss und der Zahl der Junior:innen; Buchung in Woche 1)</span>
        </p>
        {s.sponsoren.filter((x) => x.status === 'aktiv').length === 0 ? (
          <p className="leer">Noch keine Sponsoren.</p>
        ) : (
          <ul className="liste">
            {s.sponsoren
              .filter((x) => x.status === 'aktiv')
              .map((x) => (
                <li key={x.id} className="liste-zeile">
                  <span>
                    <strong>{x.name}</strong> <span className="klein">{x.branche} · {GEGENLEISTUNG_NAMEN[x.gegenleistung]} · bis Saison {x.startSaison + x.laufzeit - 1}</span>
                    {x.elternteilId && (
                      <>
                        {' '}
                        <Badge ton="warn">Firma eines Elternteils</Badge>
                      </>
                    )}
                  </span>
                  <strong>{chf(x.betrag)}/Saison</strong>
                </li>
              ))}
          </ul>
        )}
        <button
          className="knopf"
          disabled={spiel.stand!.entwurf.some((e) => e.typ === 'sponsorSuche') || s.sponsorSucheBis >= (s.saison - 1) * 52 + s.woche || !!s.spielende}
          onClick={() => spiel.entscheiden({ typ: 'sponsorSuche' })}
        >
          {spiel.stand!.entwurf.some((e) => e.typ === 'sponsorSuche')
            ? 'Sponsorensuche geplant'
            : s.sponsorSucheBis >= (s.saison - 1) * 52 + s.woche
              ? 'Sponsorensuche läuft'
              : 'Aktiv nach Sponsoren suchen (4 Wochen)'}
        </button>
        <p className="klein">Sponsoren melden sich eher bei gutem Ruf und hoher Reichweite. Jeder Vertrag verlangt eine Gegenleistung.</p>
      </Karte>

      <Karte titel="Aktionen zur Geldbeschaffung">
        <p className="klein">
          Verfügbare Helfer:innen: {helferPool(s).length} (Eltern mit Rolle «Anlässe» oder viel Engagement). Laufen mehrere Aktionen gleichzeitig, sind dieselben Leute überlastet.
        </p>
        <ul className="massnahmen">
          {AKTIVITAETEN.map((a) => {
            const grund = aktivitaetMoeglich(spiel.stand!.state, a);
            const geplant = spiel.stand!.entwurf.some((e) => e.typ === 'aktivitaet' && e.aktivitaetId === a.id);
            return (
              <li key={a.id} className="massnahme">
                <div>
                  <strong>{a.name}</strong>{' '}
                  <span className="klein">
                    · Vorbereitung {a.vorbereitung} Wo. · {a.helfer} Helfer:innen · Kosten {chf(a.kosten)} · Ertrag ca. {a.proReichweite ? 'je nach Reichweite' : `${chf(a.ertrag[0]!)}–${chf(a.ertrag[1]!)}`}
                  </span>
                  <p className="klein">{a.beschreibung}</p>
                </div>
                <button
                  className="knopf"
                  disabled={!!grund || geplant || !!s.spielende}
                  title={grund ?? undefined}
                  onClick={() => spiel.entscheiden({ typ: 'aktivitaet', aktivitaetId: a.id })}
                >
                  {geplant ? 'geplant' : grund ? grund : 'Starten'}
                </button>
              </li>
            );
          })}
        </ul>
        {spiel.stand!.state.aktivitaeten.length > 0 && (
          <>
            <h3>Laufend und abgeschlossen</h3>
            <ul className="liste">
              {[...spiel.stand!.state.aktivitaeten]
                .reverse()
                .slice(0, 8)
                .map((a) => (
                  <li key={a.id} className="liste-zeile">
                    <span>{a.status === 'laufend' ? `${AKTIVITAETEN.find((x) => x.id === a.aktivitaetId)?.name} – in Vorbereitung` : a.text}</span>
                    <Badge ton={a.status === 'laufend' ? 'info' : (a.ertrag ?? 0) > 0 ? 'gut' : 'warn'}>{a.status === 'laufend' ? 'läuft' : chf(a.ertrag ?? 0)}</Badge>
                  </li>
                ))}
            </ul>
          </>
        )}
      </Karte>

      <Karte titel="Mitgliederbeiträge" aktion={aenderbar ? <Badge ton="gut">änderbar (Vorbereitung)</Badge> : <Badge>nur in der Vorbereitung änderbar</Badge>}>
        <div className="formular-raster">
          {STUFEN.map((st) => (
            <label key={st}>
              {st} (CHF/Jahr)
              <input
                type="number"
                min={B.finanzen.beitragMin}
                max={B.finanzen.beitragMax}
                step={10}
                disabled={!aenderbar}
                value={f.beitraege[st]}
                onChange={(e) => spiel.entscheiden({ typ: 'beitrag', stufe: st, betrag: Number(e.target.value) })}
              />
              <small>Richtwert CHF {B.finanzen.beitraegeReferenz[st]}</small>
            </label>
          ))}
          <label>
            Geschwisterrabatt (%)
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              disabled={!aenderbar}
              value={f.geschwisterrabatt}
              onChange={(e) => spiel.entscheiden({ typ: 'geschwisterrabatt', prozent: Number(e.target.value) })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              disabled={!aenderbar}
              checked={f.haertefallfonds}
              onChange={(e) => spiel.entscheiden({ typ: 'haertefallfonds', aktiv: e.target.checked })}
            />
            Härtefallfonds: Familien mit tiefem Einkommen zahlen {Math.round(B.finanzen.haertefallRabatt * 100)} % weniger
          </label>
        </div>
        <p className="klein">Höhere Beiträge bringen Geld, senken aber Neueintritte und erhöhen Austritte – besonders bei Familien mit wenig Einkommen.</p>
      </Karte>

      <Karte titel="Laufende Ausgaben">
        <div className="formular-raster">
          <label>
            Material
            <select value={f.material} onChange={(e) => spiel.entscheiden({ typ: 'material', niveau: e.target.value as Niveau })}>
              {NIVEAUS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({chf(B.finanzen.material[n.id])}/Woche)
                </option>
              ))}
            </select>
          </label>
          <label>
            Trainerentschädigung
            <select value={f.entschaedigung} onChange={(e) => spiel.entscheiden({ typ: 'entschaedigung', niveau: e.target.value as Niveau })}>
              {NIVEAUS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({chf(B.finanzen.entschaedigungProTrainer[n.id])} pro Person/Woche)
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="klein">Gutes Material verbessert den Rahmen; zu tiefe Entschädigung erhöht das Rücktrittsrisiko.</p>
      </Karte>

      <Karte titel="Anwerbung">
        <ul className="massnahmen">
          {ANWERBUNG.map((m) => (
            <li key={m.id} className="massnahme">
              <div>
                <strong>{m.name}</strong> <span className="klein">· {chf(m.kosten)} · Reichweite {m.reichweite[0]}–{m.reichweite[1]} Kinder · Alter {m.alter[0]}–{m.alter[1]}</span>
                <p className="klein">{m.beschreibung}</p>
              </div>
              <div className="zeile">
                {m.zielStufeWaehlbar && (
                  <label>
                    <span className="sr-only">Zielstufe</span>
                    <select value={zielStufe} onChange={(e) => setZielStufe(e.target.value as Stufe)}>
                      {STUFEN.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  className="knopf"
                  onClick={() => spiel.entscheiden({ typ: 'anwerbung', massnahmeId: m.id, zielStufe: m.zielStufeWaehlbar ? zielStufe : undefined })}
                >
                  Diese Woche durchführen
                </button>
              </div>
            </li>
          ))}
        </ul>
        {geplant.length > 0 && (
          <>
            <h3>Geplant für diese Woche</h3>
            <ul className="liste">
              {geplant.map(({ e, i }) =>
                e.typ === 'anwerbung' ? (
                  <li key={i} className="liste-zeile">
                    <span>
                      {ANWERBUNG.find((m) => m.id === e.massnahmeId)?.name}
                      {e.zielStufe ? ` (${e.zielStufe})` : ''}
                    </span>
                    <button className="knopf klein" onClick={() => spiel.entfernen(i)}>
                      Entfernen
                    </button>
                  </li>
                ) : null
              )}
            </ul>
          </>
        )}
      </Karte>

      <Karte titel="Offene Beiträge">
        {(() => {
          const familien = Object.values(s.familien).filter((x) => x.ausstand > 0).sort((a, b) => b.ausstand - a.ausstand);
          if (familien.length === 0) return <p className="leer">Alle Beiträge sind bezahlt.</p>;
          return (
            <>
              <p>
                Total offen: <strong>{chf(familien.reduce((a, x) => a + x.ausstand, 0))}</strong>. Bei grösseren Beträgen meldet sich die Kassier:in im Posteingang;
                persönliche Gespräche führst du über die Personenansicht.
              </p>
              <ul className="liste">
                {familien.map((x) => (
                  <li key={x.id} className="liste-zeile">
                    <span>Familie {x.nachname}</span>
                    <span className="zeile">
                      {x.ratenzahlung && <Badge ton="info">Ratenzahlung</Badge>}
                      {x.saeumig && <Badge ton="warn">zahlt zurzeit nicht</Badge>}
                      {x.haertefall && <Badge>Härtefall</Badge>}
                      <strong>{chf(x.ausstand)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          );
        })()}
      </Karte>

      <Karte titel={`Buchungen Saison ${s.saison}`}>
        <div className="tabelle-huelle">
          <table className="tabelle">
            <thead>
              <tr>
                <th scope="col">Kategorie</th>
                <th scope="col" className="zahl">
                  Saison
                </th>
                <th scope="col" className="zahl">
                  Letzte Woche
                </th>
              </tr>
            </thead>
            <tbody>
              {summen(saisonBuchungen).map(([kat, betrag]) => (
                <tr key={kat}>
                  <th scope="row">{KATEGORIE_NAMEN[kat]}</th>
                  <td className={`zahl ${betrag < 0 ? 'negativ' : ''}`}>{chf(betrag)}</td>
                  <td className="zahl">{chf(letzteWoche.filter((b) => b.kategorie === kat).reduce((a, b) => a + b.betrag, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {saisonBuchungen.length === 0 && <p className="leer">Noch keine Buchungen in dieser Saison.</p>}
      </Karte>
    </div>
  );
}
