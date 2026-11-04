import { KATEGORIE_NAMEN, PHASEN_NAMEN, chf, datumText, type Buchung } from '../../engine';
import { Badge, Delta, Karte, Kennzahl, Leer } from '../components/Basis';
import { Endbewertung } from '../components/Endbewertung';
import type { SpielApi } from '../useSpiel';

function gruppiert(b: Buchung[]): [string, number][] {
  const m = new Map<string, number>();
  for (const x of b) m.set(KATEGORIE_NAMEN[x.kategorie], (m.get(KATEGORIE_NAMEN[x.kategorie]) ?? 0) + x.betrag);
  return [...m.entries()];
}

export function Wochenbericht({ spiel }: { spiel: SpielApi }) {
  const r = spiel.bericht;
  const s = spiel.stand!.state;
  if (!r) {
    return (
      <Karte titel="Wochenbericht">
        <Leer>Nach der nächsten simulierten Woche erscheint hier der Bericht.</Leer>
      </Karte>
    );
  }
  const team = (id: string) => s.teams[id]?.name ?? 'Team';
  return (
    <div className="stapel">
      <Karte titel={`Wochenbericht Saison ${r.saison}, Woche ${r.woche}`}>
        <p className="klein">
          {datumText(r.datum)} · {PHASEN_NAMEN[r.phase]}
          {r.ferien && <> · <Badge ton="info">{r.ferien}</Badge></>}
        </p>
        <div className="kennzahlen">
          <Kennzahl label="Aktive Junior:innen" wert={r.mitgliederNachher} zusatz={<Delta wert={r.mitgliederNachher - r.mitgliederVorher} />} />
          <Kennzahl label="Ø Zufriedenheit" wert={r.zufriedenheitNachher.toFixed(1)} zusatz={<Delta wert={r.zufriedenheitNachher - r.zufriedenheitVorher} dezimal={1} />} />
          <Kennzahl label="Kasse" wert={chf(r.kasseNachher)} zusatz={<Delta wert={r.kasseNachher - r.kasseVorher} einheit=" CHF" />} />
        </div>
      </Karte>

      {r.saisonBilanz && (
        <Karte titel={`Saisonbilanz ${r.saisonBilanz.saison}`} className="hervorgehoben">
          {r.saisonBilanz.endbewertung ? (
            <Endbewertung eb={r.saisonBilanz.endbewertung} />
          ) : (
            <p className="gross-text">
              {r.saisonBilanz.bewertung} Punkte – «{r.saisonBilanz.titel}»
            </p>
          )}
          <ul>
            <li>
              Junior:innen: {r.saisonBilanz.mitgliederStart} → {r.saisonBilanz.mitgliederEnde} (Ø Zufriedenheit {r.saisonBilanz.zufriedenheitSchnitt})
            </li>
            <li>
              Eintritte {r.saisonBilanz.eintritte}, Austritte {r.saisonBilanz.austritte}, U18-Abgänger:innen {r.saisonBilanz.u18Abgaenger}, Übertritte{' '}
              {r.saisonBilanz.uebertritte}
            </li>
            <li>Kasse am Saisonende: {chf(r.saisonBilanz.kasseEnde)}</li>
            {r.saisonBilanz.wettkampf.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {s.spielende && <p className="hinweis">{s.spielende.text}</p>}
          {s.spielende && (
            <p className="klein">Die vollständige Endbewertung und die Chronik findest du in der Übersicht.</p>
          )}
        </Karte>
      )}

      {(r.eintritte.length > 0 || r.austritte.length > 0 || r.schnupper.length > 0) && (
        <Karte titel="Mitglieder">
          <ul className="liste-einfach">
            {r.schnupper.map((x) => (
              <li key={x.id}>🆕 {x.name} kommt zum Schnuppern.</li>
            ))}
            {r.eintritte.map((x) => (
              <li key={x.id}>✔ {x.name} {x.text}.</li>
            ))}
            {r.austritte.map((x) => (
              <li key={x.id}>✖ {x.name} tritt aus ({x.grund}).</li>
            ))}
          </ul>
        </Karte>
      )}

      {r.spiele.length > 0 && (
        <Karte titel="Spiele">
          <ul className="liste-einfach">
            {r.spiele.map((x, i) => (
              <li key={i}>{x.text}</li>
            ))}
          </ul>
        </Karte>
      )}

      <Karte titel="Trainings">
        <ul className="liste-einfach">
          {r.trainings.map((x) => (
            <li key={x.teamId}>
              <strong>{team(x.teamId)}:</strong> {x.text}
            </li>
          ))}
        </ul>
      </Karte>

      {(r.meldungen.length > 0 || r.fehler.length > 0) && (
        <Karte titel="Meldungen">
          <ul className="liste-einfach">
            {r.meldungen.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
            {r.fehler.map((m, i) => (
              <li key={`f${i}`} className="negativ">
                Nicht umgesetzt: {m}
              </li>
            ))}
          </ul>
        </Karte>
      )}

      <Karte titel="Buchungen der Woche">
        <ul className="liste-einfach">
          {gruppiert(r.buchungen).map(([k, b]) => (
            <li key={k} className="liste-zeile">
              <span>{k}</span>
              <span className={b < 0 ? 'negativ' : 'positiv'}>{chf(b)}</span>
            </li>
          ))}
        </ul>
      </Karte>
    </div>
  );
}
