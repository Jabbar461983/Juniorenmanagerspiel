import { useState } from 'react';
import {
  B,
  BILD_NAMEN,
  GEGENLEISTUNG_NAMEN,
  POST_NAMEN,
  aktiveSponsoren,
  benoetigtePosts,
  chf,
  frequenz,
  name,
  ohneEinwilligung,
  postsImMonat,
  teamKinder,
  type Bildwahl,
  type PostTyp
} from '../../engine';
import { Badge, Balken, Karte, Kennzahl, Leer } from '../components/Basis';
import type { SpielApi } from '../useSpiel';

const FREQUENZ_TEXT = { selten: 'selten', regelmaessig: 'regelmässig', oft: 'oft' } as const;

export function SocialMedia({ spiel }: { spiel: SpielApi }) {
  const s = spiel.ansicht!;
  const basis = spiel.stand!.state;
  const [typ, setTyp] = useState<PostTyp>('training');
  const [teamId, setTeamId] = useState<string>(Object.keys(s.teams)[0] ?? '');
  const [bilder, setBilder] = useState<Bildwahl>('nurMitEinwilligung');
  const [werbung, setWerbung] = useState(0);
  const geplant = spiel.stand!.entwurf.map((e, i) => ({ e, i })).filter((x) => x.e.typ === 'post');
  const voll = geplant.length >= B.social.maxPostsProWoche;
  const pflicht = benoetigtePosts(s);
  const imMonat = postsImMonat(basis);
  const kommunikation = Object.values(s.vorstand.mitglieder).find((m) => m.amt === 'kommunikation');
  const ohne = ohneEinwilligung(s, teamId || null);

  return (
    <div className="stapel">
      <div className="kennzahlen">
        <Kennzahl label="Reichweite" wert={Math.round(s.social.reichweite)} zusatz="mehr Schnupperanfragen und Sponsoreninteresse" />
        <Kennzahl label="Ruf" wert={Math.round(s.verein.ruf)} zusatz="wirkt auf Vorstand, Gesuche und Trainerrekrutierung" />
        <Kennzahl
          label="Posts in den letzten 4 Wochen"
          wert={imMonat}
          ton={pflicht > 0 ? (imMonat >= pflicht ? 'gut' : 'warn') : undefined}
          zusatz={pflicht > 0 ? `Sponsoren erwarten ${pflicht}` : undefined}
        />
        <Kennzahl label="Grundfrequenz des Vereins" wert={FREQUENZ_TEXT[frequenz(s)]} zusatz={kommunikation ? `bestimmt von ${name(kommunikation)}` : undefined} />
      </div>

      <Karte titel="Neuer Post">
        <div className="formular-raster">
          <label>
            Inhalt
            <select value={typ} onChange={(e) => setTyp(e.target.value as PostTyp)}>
              {(Object.keys(POST_NAMEN) as PostTyp[]).map((t) => (
                <option key={t} value={t}>
                  {POST_NAMEN[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Team
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">ganze Abteilung</option>
              {Object.values(s.teams).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bilder
            <select value={bilder} onChange={(e) => setBilder(e.target.value as Bildwahl)}>
              {(Object.keys(BILD_NAMEN) as Bildwahl[]).map((b) => (
                <option key={b} value={b}>
                  {BILD_NAMEN[b]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Werbung (CHF)
            <input type="number" min={0} max={B.social.maxWerbung} step={50} value={werbung} onChange={(e) => setWerbung(Number(e.target.value))} />
          </label>
        </div>
        {bilder === 'alle' && ohne.length > 0 && (
          <p className="hinweis warn" role="alert">
            Achtung: {ohne.length} Familie{ohne.length === 1 ? '' : 'n'} {teamId ? 'in diesem Team ' : ''}haben keine Einwilligung für Bilder gegeben. Ein solcher Post kann Ärger geben.
          </p>
        )}
        <p className="klein">
          Matchberichte wirken in Wochen mit Spielen, Berichte über Anlässe nach einer Aktion. Bilder machen Posts wirksamer – aber nur mit Einwilligung der Eltern.
        </p>
        <button
          className="knopf primaer"
          disabled={voll || !!s.spielende}
          onClick={() => spiel.entscheiden({ typ: 'post', postTyp: typ, teamId: teamId || null, bilder, werbung })}
        >
          Post planen
        </button>{' '}
        {voll && <span className="klein">Diese Woche sind bereits {B.social.maxPostsProWoche} Posts geplant.</span>}
        {geplant.length > 0 && (
          <ul className="liste">
            {geplant.map(({ e, i }) =>
              e.typ === 'post' ? (
                <li key={i} className="liste-zeile">
                  <span>
                    {POST_NAMEN[e.postTyp]} {e.teamId ? `(${s.teams[e.teamId]?.name})` : ''} · {BILD_NAMEN[e.bilder]}
                    {e.werbung ? ` · Werbung ${chf(e.werbung)}` : ''}
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

      <Karte titel="Einwilligungen für Bilder">
        <ul className="liste">
          {Object.values(s.teams).map((t) => {
            const familien = new Set(teamKinder(s, t.id).map((k) => k.familieId));
            const ohneTeam = ohneEinwilligung(s, t.id).length;
            return (
              <li key={t.id} className="liste-zeile">
                <span>{t.name}</span>
                <span className="zeile">
                  <Balken wert={familien.size ? ((familien.size - ohneTeam) / familien.size) * 100 : 100} />
                  <span className="klein">
                    {familien.size - ohneTeam}/{familien.size} Familien
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Karte>

      <Karte titel="Sponsoren mit Gegenleistung">
        {aktiveSponsoren(s).length === 0 ? (
          <Leer>Keine laufenden Sponsoringverträge.</Leer>
        ) : (
          <ul className="liste">
            {aktiveSponsoren(s).map((sp) => (
              <li key={sp.id} className="liste-zeile">
                <span>
                  <strong>{sp.name}</strong> <span className="klein">{GEGENLEISTUNG_NAMEN[sp.gegenleistung]}</span>
                </span>
                <Badge ton={sp.zufriedenheit >= 60 ? 'gut' : sp.zufriedenheit >= B.sponsoren.verlaengerungAb ? 'info' : 'warn'}>
                  Zufriedenheit {Math.round(sp.zufriedenheit)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Karte>

      <Karte titel="Veröffentlichte Posts">
        {basis.social.posts.length === 0 ? (
          <Leer>Noch keine Posts.</Leer>
        ) : (
          <ul className="liste">
            {[...basis.social.posts]
              .reverse()
              .slice(0, 12)
              .map((p) => (
                <li key={p.id} className="liste-zeile">
                  <span>
                    <span className="klein">
                      S{p.saison} W{p.woche}
                    </span>{' '}
                    {POST_NAMEN[p.typ]} {p.teamId ? `(${basis.teams[p.teamId]?.name ?? ''})` : ''}
                    {p.problem && (
                      <>
                        {' '}
                        <Badge ton="schlecht">ohne Einwilligung</Badge>
                      </>
                    )}
                  </span>
                  <span className="klein">+{p.reichweiteGewinn} Reichweite</span>
                </li>
              ))}
          </ul>
        )}
      </Karte>
    </div>
  );
}
