import { useState } from 'react';
import {
  ANTRAG_NAMEN,
  B,
  HALTUNG_NAMEN,
  amtName,
  chf,
  haltungKategorie,
  istSitzungswoche,
  name,
  prioritaetName,
  verfuegbareDialoge,
  wochenBisSitzung,
  type AntragTyp,
  type Vorstandsmitglied
} from '../../engine';
import { Badge, Balken, Karte, Kennzahl, Leer } from '../components/Basis';
import { Gespraech } from '../components/Gespraech';
import { Portrait } from '../components/Portrait';
import { geplanteGespraeche } from '../entwurf';
import type { SpielApi } from '../useSpiel';

const TYPEN: AntragTyp[] = ['budget', 'material', 'trainerentschaedigung', 'neuesTeam', 'hallenzeiten'];

function haltungTon(h: number): 'gut' | 'warn' | undefined {
  const k = haltungKategorie(h);
  return k === 'unterstuetzer' ? 'gut' : k === 'skeptisch' ? 'warn' : undefined;
}

export function Vorstand({ spiel }: { spiel: SpielApi }) {
  const s = spiel.ansicht!;
  const basis = spiel.stand!.state;
  const v = s.vorstand;
  const [typ, setTyp] = useState<AntragTyp>('material');
  const [betrag, setBetrag] = useState(500);
  const [gespraech, setGespraech] = useState<{ dialogId: string; personId: string } | null>(null);
  const bis = wochenBisSitzung(s);
  const sitzungJetzt = istSitzungswoche(s);
  const vorbereitungGeplant = spiel.stand!.entwurf.some((e) => e.typ === 'sitzungVorbereiten');
  const kontingentVoll = geplanteGespraeche(spiel.stand!.entwurf) >= B.dialog.gespraecheProWoche;
  const geplanteAntraege = spiel.stand!.entwurf.map((e, i) => ({ e, i })).filter((x) => x.e.typ === 'antrag');
  const letzteSitzungen = [...v.sitzungen].reverse().slice(0, 6);
  const einflussTon = s.verein.vorstandEinfluss >= 60 ? 'gut' : s.verein.vorstandEinfluss < 25 ? 'schlecht' : 'warn';

  return (
    <div className="stapel">
      {gespraech && <Gespraech spiel={spiel} dialogId={gespraech.dialogId} personId={gespraech.personId} schliessen={() => setGespraech(null)} />}
      <div className="kennzahlen">
        <Kennzahl
          label="Dein Einfluss im Vorstand"
          wert={Math.round(s.verein.vorstandEinfluss)}
          ton={einflussTon}
          zusatz={s.verein.vorstandEinfluss < 20 && !s.lernmodus ? 'Unter 10 droht die Absetzung!' : v.spielerImVorstand ? 'Du bist Vorstandsmitglied.' : `Ab ${B.vorstand.gv.wahlAbEinfluss} wirst du an der GV in den Vorstand gewählt.`}
        />
        <Kennzahl label="Nächste Sitzung" wert={sitzungJetzt ? 'diese Woche' : `in ${bis} Woche${bis === 1 ? '' : 'n'}`} zusatz={`Vorbereitung: ${Math.round(v.vorbereitung)} Punkte`} />
        <Kennzahl
          label="Jahresbudget nächste Saison"
          wert={v.gv.some((g) => g.saison === s.saison) ? chf(v.jahresbudget) : 'offen'}
          zusatz={v.gv.some((g) => g.saison === s.saison) ? 'Beschluss der GV' : 'Die GV entscheidet im Mai – je höher dein Einfluss, desto mehr.'}
        />
        <Kennzahl label="Ruf der Junioren" wert={Math.round(s.verein.ruf)} />
      </div>

      {v.konkursStufe > 0 && (
        <div className="hinweis warn" role="alert">
          {v.konkursStufe === 1 && 'Die Kasse ist im Minus. Der Vorstand erwartet Massnahmen.'}
          {v.konkursStufe === 2 && 'Die Kasse ist seit Wochen im Minus: Das nächste Jahresbudget wird gekürzt.'}
          {v.konkursStufe >= 2 && !v.rettungsplan && !s.lernmodus && ' Ohne Rettungsplan droht die Absetzung.'}
          {v.rettungsplan && ' Ein Rettungsplan ist in Arbeit – der Vorstand gibt dir mehr Zeit.'}
        </div>
      )}

      <Karte titel="Vorstandsmitglieder">
        <ul className="kartenraster">
          {Object.values(v.mitglieder).map((m: Vorstandsmitglied) => {
            const dialoge = verfuegbareDialoge(basis, m.id);
            return (
              <li key={m.id} className="vorstand-karte">
                <div className="zeile">
                  <Portrait meta={m.portrait} personId={m.id} vorname={m.vorname} nachname={m.nachname} groesse={48} />
                  <div className="personenkarte-text">
                    <strong>{name(m)}</strong>
                    <span className="klein">{amtName(m.amt)}</span>
                    <span>
                      <Badge ton={haltungTon(m.haltung)}>{HALTUNG_NAMEN[haltungKategorie(m.haltung)]}</Badge>
                    </span>
                    <span className="klein">Priorität: {m.bekannt.includes('prioritaet') ? prioritaetName(m.prioritaet) : '?'}</span>
                  </div>
                </div>
                <div className="zeile">
                  {dialoge.map(({ dialog, gesperrt }) => (
                    <button
                      key={dialog.id}
                      className="knopf klein"
                      disabled={!!gesperrt || kontingentVoll || !!s.spielende}
                      title={gesperrt ?? (kontingentVoll ? 'Diese Woche sind keine Gespräche mehr möglich.' : dialog.beschreibung)}
                      onClick={() => setGespraech({ dialogId: dialog.id, personId: m.id })}
                    >
                      💬 {dialog.titel}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="klein">Einzelgespräche verbessern Haltung und Vorbereitung. Sie zählen zu deinen {B.dialog.gespraecheProWoche} Gesprächen pro Woche.</p>
      </Karte>

      <Karte titel="Anträge an den Vorstand">
        <p className="klein">
          Pro Sitzung werden höchstens {B.vorstand.maxAntraegeProSitzung} Anträge behandelt. Abgelehnte Anträge kosten Einfluss; jeder genehmigte Antrag macht den Vorstand in dieser Saison zurückhaltender.
        </p>
        <div className="formular-zeile">
          <label>
            Antrag
            <select value={typ} onChange={(e) => setTyp(e.target.value as AntragTyp)}>
              {TYPEN.map((t) => (
                <option key={t} value={t}>
                  {ANTRAG_NAMEN[t]}
                </option>
              ))}
            </select>
          </label>
          {typ !== 'hallenzeiten' && (
            <label>
              Betrag (CHF)
              <input type="number" min={100} max={B.vorstand.maxBetrag} step={100} value={betrag} onChange={(e) => setBetrag(Number(e.target.value))} />
            </label>
          )}
          <button className="knopf" disabled={!!s.spielende} onClick={() => spiel.entscheiden({ typ: 'antrag', antragTyp: typ, betrag: typ === 'hallenzeiten' ? 0 : betrag })}>
            Antrag stellen
          </button>
          <button className="knopf" disabled={vorbereitungGeplant || !!s.spielende} onClick={() => spiel.entscheiden({ typ: 'sitzungVorbereiten' })}>
            {vorbereitungGeplant ? 'Bericht wird vorbereitet' : 'Bericht für die Sitzung vorbereiten'}
          </button>
        </div>
        {v.offeneAntraege.length === 0 && geplanteAntraege.length === 0 ? (
          <Leer>Keine offenen Anträge.</Leer>
        ) : (
          <ul className="liste">
            {basis.vorstand.offeneAntraege.map((a) => {
              const zurueck = spiel.stand!.entwurf.some((e) => e.typ === 'antragZurueckziehen' && e.antragId === a.id);
              return (
                <li key={a.id} className="liste-zeile">
                  <span>
                    {ANTRAG_NAMEN[a.typ]} {a.typ !== 'hallenzeiten' && `(${chf(a.betrag)})`} <Badge ton="info">eingereicht</Badge>
                    {zurueck && <Badge ton="warn">wird zurückgezogen</Badge>}
                  </span>
                  {!zurueck && (
                    <button className="knopf klein" onClick={() => spiel.entscheiden({ typ: 'antragZurueckziehen', antragId: a.id })}>
                      Zurückziehen
                    </button>
                  )}
                </li>
              );
            })}
            {geplanteAntraege.map(({ e, i }) =>
              e.typ === 'antrag' ? (
                <li key={`g${i}`} className="liste-zeile">
                  <span>
                    {ANTRAG_NAMEN[e.antragTyp]} {e.antragTyp !== 'hallenzeiten' && `(${chf(e.betrag)})`} <Badge>geplant</Badge>
                  </span>
                  <button className="knopf klein" onClick={() => spiel.entfernen(i)}>
                    Entfernen
                  </button>
                </li>
              ) : null
            )}
          </ul>
        )}
      </Karte>

      <Karte titel="Einfluss und Sitzungen">
        <Balken label="Einfluss" wert={s.verein.vorstandEinfluss} ton="auto" />
        {letzteSitzungen.length === 0 ? (
          <Leer>Noch keine Sitzung.</Leer>
        ) : (
          <ul className="liste">
            {letzteSitzungen.map((z, i) => (
              <li key={i} className="sitzung">
                <div className="liste-zeile">
                  <strong>
                    Sitzung S{z.saison} W{z.woche}
                  </strong>
                  <span className="klein">
                    Einfluss {Math.round(z.einflussVorher)} → {Math.round(z.einflussNachher)}
                  </span>
                </div>
                {z.ergebnisse.length === 0 ? (
                  <p className="klein">Keine Anträge.</p>
                ) : (
                  <ul className="infoliste">
                    {z.ergebnisse.map((e, j) => (
                      <li key={j}>
                        {ANTRAG_NAMEN[e.antrag.typ]} {e.antrag.typ !== 'hallenzeiten' && `(${chf(e.antrag.betrag)})`}:{' '}
                        <Badge ton={e.angenommen ? 'gut' : 'schlecht'}>{e.angenommen ? 'angenommen' : 'abgelehnt'}</Badge>{' '}
                        <span className="klein">
                          {e.stimmen.filter((x) => x.ja).length}:{e.stimmen.filter((x) => !x.ja).length}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Karte>

      {v.gv.length > 0 && (
        <Karte titel="Generalversammlungen">
          <ul className="infoliste">
            {[...v.gv].reverse().map((g) => (
              <li key={g.saison}>
                <strong>Saison {g.saison}:</strong> {g.text}
              </li>
            ))}
          </ul>
        </Karte>
      )}
    </div>
  );
}
