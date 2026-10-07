// Markdown + formules LaTeX → sections HTML prêtes à afficher.
//
// Les formules sont mises de côté avant marked (sinon `_` et `*` y seraient
// pris pour de l'italique), rendues avec KaTeX, puis remises à leur place.
// Le découpage en sections ne dépend que des titres : un document sans titre
// est coupé en morceaux de taille raisonnable.

const TAILLE_MAX_SECTION = 3000; // caractères, pour les documents sans titres
const NIVEAU_MAX_TITRE = 3;      // # , ## et ### ouvrent une nouvelle section

// Remplace chaque formule par un repère « @@MATHn@@ » ; le code (``` et `) est laissé intact.
function extraireFormules(texte) {
  const formules = [];
  const motif = /(```[\s\S]*?```|`[^`\n]*`)|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$])\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\d)/g;
  const sortie = texte.replace(motif, (tout, code, bloc1, bloc2, enLigne1, enLigne2) => {
    if (code) return code;
    const bloc = bloc1 ?? bloc2;
    const n = formules.push({ tex: bloc ?? enLigne1 ?? enLigne2, bloc: bloc !== undefined }) - 1;
    // Même une formule en bloc reste dans son paragraphe : la couper du texte casserait
    // une mise en forme qui l'entoure (théorème en italique de pandoc : *Si … $$…$$*).
    return `@@MATH${n}@@`;
  });
  return { sortie, formules };
}

function rendreFormule({ tex, bloc }) {
  try {
    const html = katex.renderToString(tex.trim(), { displayMode: bloc, throwOnError: false, strict: 'ignore' });
    // .formule-bloc : un <span> affiché en bloc (valide dans un paragraphe ou un italique),
    // qui défile horizontalement si l'équation est trop large.
    return bloc ? `<span class="formule-bloc">${html}</span>` : html;
  } catch {
    return `<code>${tex}</code>`;
  }
}

function remettreFormules(html, formules) {
  return html.replace(/@@MATH(\d+)@@/g, (_, n) => rendreFormule(formules[n]));
}

function texteBrut(token) {
  return (token.text ?? '').replace(/@@MATH\d+@@/g, '…').replace(/[*_`]/g, '').trim();
}

// Regroupe les tokens de marked en sections (titre + contenu).
function grouperEnSections(tokens) {
  const sections = [];
  let courante = null;
  const nouvelle = (titre, niveau) => {
    courante = { titre, niveau, tokens: [], taille: 0 };
    sections.push(courante);
  };

  for (const token of tokens) {
    if (token.type === 'heading' && token.depth <= NIVEAU_MAX_TITRE) {
      nouvelle(texteBrut(token), token.depth);
      courante.tokens.push(token);
      continue;
    }
    if (!courante) nouvelle('Début', 0);
    // Section trop longue (document sans titres) : on coupe entre deux blocs.
    if (courante.taille > TAILLE_MAX_SECTION && token.type !== 'space') {
      nouvelle(`${courante.titre.replace(/ \(suite\)$/, '')} (suite)`, courante.niveau);
    }
    courante.tokens.push(token);
    courante.taille += (token.raw ?? '').length;
  }
  return sections.filter(s => s.tokens.some(t => t.type !== 'space'));
}

// Encadrés : une citation (> ...) qui commence par un mot-clé en gras prend une couleur.
//   > **Piège :** …   > **Tombé en partiel (2024, ex. 2) :** …   > **Méthode (TD 3) :** …
//   > **Complément (TD 2, ex. 4) :** notion absente du cours, ajoutée depuis un TD, un partiel ou des notes
const ENCADRES = [
  [/^(piège|attention|erreur)/i, 'piege'],
  [/^(tombé|partiel|annale|examen)/i, 'partiel'],
  [/^(méthode|astuce|réflexe)/i, 'methode'],
  [/^(à retenir|définition|théorème|propriété|formule)/i, 'retenir'],
  [/^(complément|hors cours|pour aller plus loin)/i, 'complement'],
];

function colorerEncadres(html) {
  return html.replace(/<blockquote>(\s*<p><strong>)([^<]*)/g, (tout, debut, motCle) => {
    const trouve = ENCADRES.find(([motif]) => motif.test(motCle.trim()));
    return trouve ? `<blockquote class="encadre-${trouve[1]}">${debut}${motCle}` : tout;
  });
}

// Liens et images relatifs : ils partent du dossier du fichier .md (base, relatif à matieres/).
// Une image relative devient <img data-chemin="…"> : l'app la charge elle-même (donnees.js),
// en clair ou déchiffrée. Un lien relatif pointe vers le fichier en clair.
const MARQUE_IMAGE = '@@CHEMIN@@';

function corrigerChemins(tokens, base) {
  marked.walkTokens(tokens, token => {
    if ((token.type === 'image' || token.type === 'link') && !/^([a-z]+:|\/|#)/i.test(token.href)) {
      token.href = (token.type === 'image' ? MARQUE_IMAGE : '../matieres/') + base + token.href;
    }
  });
}

const marquerImages = html => html.replaceAll(`src="${MARQUE_IMAGE}`, 'data-chemin="');

// Point d'entrée : texte Markdown → [{ titre, niveau, html }]
export function decouper(texte, base = '') {
  const { sortie, formules } = extraireFormules(texte);
  const tokens = marked.lexer(sortie);
  corrigerChemins(tokens, base);
  return grouperEnSections(tokens).map(({ titre, niveau, tokens }) => {
    tokens.links = {};
    const brut = marked.parser(tokens)
      // Une image seule dans son paragraphe devient une figure légendée.
      .replace(/<p>(<img [^>]*alt="([^"]+)"[^>]*>)<\/p>/g, '<figure>$1<figcaption>$2</figcaption></figure>')
      // Dans l'attribut alt, une formule reste en texte (du HTML KaTeX le casserait).
      .replace(/alt="([^"]*)"/g, (_, alt) => `alt="${alt.replace(/@@MATH(\d+)@@/g, (_, n) => formules[n].tex.replace(/"/g, '&quot;'))}"`);
    const html = remettreFormules(colorerEncadres(marquerImages(brut)), formules)
      // Les tableaux larges défilent eux aussi sur le côté.
      .replace(/<table>/g, '<div class="defile"><table>').replace(/<\/table>/g, '</table></div>');
    return { titre, niveau, html };
  });
}

// Rendu d'un petit morceau de Markdown (énoncés, corrigés…).
export function rendre(texte) {
  const { sortie, formules } = extraireFormules(texte);
  return remettreFormules(marked.parse(sortie), formules);
}
