# Guarida — Legal Reference Dataset (Draft v1)

**Every entry below is `lawyer_reviewed: false`.** This is a starting point
for the case-intake module's suggestion engine, sourced from real statute
text and legal-summary sites, not verified by an actual attorney licensed
in the relevant jurisdiction. Do not treat any of this as legal advice, and
do not let the app present it to a real authority as settled fact until a
lawyer has signed off — that rule is enforced in code (`case_legal_matches`
always requires human confirmation), but it's worth restating here too.

One honest flag before the data: two different sources disagreed on the
Nayarit penal code article number (422 vs. 384) for the same offense —
noted below rather than silently picking one. That kind of discrepancy is
exactly why lawyer review isn't optional before this goes live.

---

## SQL seed

```sql
insert into legal_references (jurisdiction, statute_code, title, summary, source_url, lawyer_reviewed) values

-- ==================== MEXICO — FEDERAL ====================
('MX-Federal', 'CPF Art. 419 Bis',
 'Peleas de perros (dogfighting)',
 'Sanciona con 6 meses a 5 años de prisión y multa de 200 a 2000 días a quien críe, entrene, posea, transporte, compre o venda perros para peleas, así como a organizadores, promotores y espectadores con conocimiento de causa. La pena aumenta para servidores públicos.',
 'https://www.conceptosjuridicos.com/mx/delito-de-maltrato-animal/',
 false),

('MX-Federal', 'CPF Art. 419 Bis 1',
 'Maltrato o crueldad animal (reforma federal, vigente desde nov. 2024)',
 'Sanciona con 1 a 3 años de prisión y multa de 300 a 500 UMA a quien, con dolo, ejecute actos de maltrato o crueldad hacia cualquier especie animal, resultando en lesiones, daño o alteraciones significativas. Agravantes: riesgo de vida, discapacidad permanente, o mutilación sin fin veterinario justificado.',
 'http://sil.gobernacion.gob.mx/Archivos/Documentos/2024/11/asun_4804817_20241120_1732127583.pdf',
 false),

('MX-Federal', 'CPF Art. 419 Bis 2',
 'Maltrato o crueldad animal resultando en muerte (reforma federal, vigente desde nov. 2024)',
 'Sanciona con 2 a 6 años de prisión y multa de 600 a 1200 UMA a quien intencionalmente maltrate o cometa actos de crueldad contra un animal resultando en su muerte.',
 'http://sil.gobernacion.gob.mx/Archivos/Documentos/2024/11/asun_4804817_20241120_1732127583.pdf',
 false),

('MX-Federal', 'CPF Art. 419 Bis 3',
 'Utilización de un animal con fines sexuales (reforma federal, vigente desde nov. 2024)',
 'Sanciona con 1 a 3 años de prisión y multa de 500 a 1000 UMA a quien utilice a un animal con fines sexuales, incluyendo zoofilia y producción/distribución de material relacionado.',
 'http://sil.gobernacion.gob.mx/Archivos/Documentos/2024/11/asun_4804817_20241120_1732127583.pdf',
 false),

-- ==================== MEXICO — NAYARIT (STATE) ====================
-- NOTE: article number discrepancy across sources (422 vs 384) — flagged, not resolved.
('MX-Nayarit', 'CPN Art. 422 (also cited as Art. 384 in one source — needs lawyer verification)',
 'Maltrato o crueldad animal (Código Penal para el Estado de Nayarit)',
 'Sanciona con 3 meses a 3 años de prisión y multa de 60 a 360 días a quien realice actos de maltrato o crueldad animal, incluyendo: causar la muerte por métodos no oficiales o que prolonguen la agonía; tortura, sadismo, zoofilia, mutilación sin fin médico; privación de aire, luz, alimento, bebida, espacio o abrigo; privación de atención veterinaria; abandono que ponga en riesgo la vida del animal.',
 'https://sinmaltrato.org/files/atlas/nay/codigo-penal-nay.pdf',
 false),

('MX-Nayarit', 'CPN Art. 423',
 'Agravantes al delito de maltrato o crueldad animal (Nayarit)',
 'Permite duplicar las sanciones del Art. 422 cuando: el propietario pierde todo derecho sobre el animal tras sentencia; el agresor graba/publica el maltrato; o el acto es cometido por un médico veterinario u otro profesional relacionado.',
 'https://sinmaltrato.org/files/atlas/nay/codigo-penal-nay.pdf',
 false),

('MX-Nayarit', 'Ley de Protección a la Fauna para el Estado de Nayarit, Art. 71',
 'Obligación de denunciar (Nayarit)',
 'Obliga a toda persona y autoridades estatales/municipales que tengan conocimiento de actos que pudieran constituir un delito conforme al Código Penal en materia de fauna, a denunciarlos ante el Ministerio Público.',
 'https://docs.mexico.justia.com/estatales/nayarit/ley-de-proteccion-a-la-fauna-para-el-estado-de-nayarit.pdf',
 false),

-- ==================== UNITED STATES — CALIFORNIA ====================
('US-CA', 'Cal. Penal Code § 597(a)',
 'Animal cruelty — intentional/malicious (California)',
 'Maliciously and intentionally maiming, mutilating, torturing, wounding, or killing a living animal. A "wobbler" — chargeable as misdemeanor (up to 1 year county jail, $20,000 fine) or felony (16 months/2/3 years, $20,000 fine).',
 'https://codes.findlaw.com/ca/penal-code/pen-sect-597/',
 false),

('US-CA', 'Cal. Penal Code § 597(b)',
 'Animal cruelty — neglect (California)',
 'Overdriving, overworking, or depriving an animal of necessary food, water, or shelter; failing to provide veterinary care; cruelly beating or killing. Same wobbler penalty structure as § 597(a).',
 'https://codes.findlaw.com/ca/penal-code/pen-sect-597/',
 false),

('US-CA', 'Cal. Penal Code § 597.5',
 'Dogfighting (California)',
 'Owning, training, or causing a dog to fight is a felony — up to 3 years prison and $50,000 fine. Being a spectator is a misdemeanor.',
 'https://www.shouselaw.com/ca/defense/penal-code/597/',
 false),

-- ==================== UNITED STATES — WASHINGTON ====================
('US-WA', 'RCW 16.52.205',
 'Animal cruelty in the first degree (Washington)',
 'Class C felony. Intentionally inflicting substantial pain, causing physical injury, or killing an animal by means causing undue suffering; or with criminal negligence starving, dehydrating, suffocating, or exposing an animal to excessive heat/cold causing substantial pain or death. Includes sexual conduct with an animal.',
 'https://app.leg.wa.gov/rcw/default.aspx?cite=16.52.205',
 false),

('US-WA', 'RCW 16.52.207',
 'Animal cruelty in the second degree (Washington)',
 'Gross misdemeanor. Knowingly, recklessly, or with criminal negligence inflicting unnecessary suffering or pain on an animal, under circumstances not amounting to first-degree cruelty. Economic distress can be an affirmative defense for failure to provide care.',
 'https://prosecutingattorneys.org/wp-content/uploads/Washington-Animal-Cruelty-Summary.pdf',
 false),

-- ==================== MEXICO — FEDERAL WILDLIFE ====================
('MX-Federal', 'LGVS Art. 29-30',
 'Trato digno y respetuoso a la fauna silvestre (Ley General de Vida Silvestre)',
 'Obliga a la Federación, estados y municipios a adoptar medidas para evitar o disminuir tensión, sufrimiento, traumatismo y dolor a ejemplares de fauna silvestre durante su aprovechamiento, traslado, exhibición, cuarentena, entrenamiento, comercialización y sacrificio. Prohíbe estrictamente todo acto de crueldad contra la fauna silvestre.',
 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LGVS.pdf',
 false),

('MX-Federal', 'LGVS Art. 3, fracción X y XXVI',
 'Definiciones legales de "crueldad" y "maltrato" hacia fauna silvestre',
 'Crueldad: acto de brutalidad, sádico o zoofílico contra cualquier animal, por acción directa, omisión o negligencia. Maltrato: todo hecho, acto u omisión humana que ocasione dolor, deterioro físico o sufrimiento, afecte el bienestar, ponga en peligro la vida del animal, o afecte gravemente su salud o integridad física.',
 'http://www.ordenjuridico.gob.mx/Documentos/Federal/html/wo83190.html',
 false);
```

---

## Scope note

Wildlife entries included above because Wet Noses is the **pilot**, not the
**boundary** — Guarida is built for any rescue, shelter, or animal hotel,
including wildlife rehabilitation centers. Domestic-animal statutes (dogs/
cats) and wildlife statutes are legally distinct in Mexico (fauna silvestre
falls under federal jurisdiction via LGVS and PROFEPA; domestic animals
under state penal codes), so both need their own entries rather than
assuming one covers the other. Same logic applies as more US states or
other countries get added — draft broadly for the platform, not narrowly
for one org's current case mix.

## What's deliberately not included yet
- **Wildlife trafficking/illegal possession penalties** under LGVS — sources
  reference fines and 1-9 year prison terms for illegal wildlife trade, but
  citations were vague enough that I didn't draft a specific entry rather
  than guess at a figure I couldn't pin down cleanly.
- **Jalisco, Nuevo León, or other Mexican states** — not in scope unless
  Wet Noses' network expands there.
- **Canada** (British Columbia especially, given fosters reaching Vancouver)
  — flagged in the last progress report as a possible future addition, not
  drafted here.

## Next step
This needs an actual lawyer — ideally one licensed in Nayarit for the
Mexican side, and separately for California/Washington — to review before
`lawyer_reviewed` flips to `true` on any entry. Until then, the case-intake
suggestion engine will surface these as candidates, never as confirmed law.
