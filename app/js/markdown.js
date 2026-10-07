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
    // Une formule en bloc devient un paragraphe à part entière.
    return bloc !== undefined ? `\n\n@@MATH${n}@@\n\n` : `@@MATH${n}@@`;
  });
  return { sortie, formules };
}

function rendreFormule({ tex, bloc }) {
  try {
    const html = katex.renderToString(tex.trim(), { displayMode: bloc, throwOnError: false, strict: 'ignore' });
    // Le conteneur .formule-bloc défile horizontalement si l'équation est trop large.
    return bloc ? `<div class="formule-bloc">${html}</div>` : html;
  } catch {
    return `<code>${tex}</code>`;
  }
}

function remettreFormules(html, formules) {
  return html
    .replace(/<p>@@MATH(\d+)@@<\/p>/g, (_, n) => rendreFormule(formules[n]))
    .replace(/@@MATH(\d+)@@/g, (_, n) => rendreFormule(formules[n]));
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

// Les liens et images relatifs pointent vers le dossier du fichier .md, pas vers l'app.
function corrigerChemins(tokens, base) {
  marked.walkTokens(tokens, token => {
    if ((token.type === 'image' || token.type === 'link') && !/^([a-z]+:|\/|#)/i.test(token.href)) {
      token.href = base + token.href;
    }
  });
}

// Point d'entrée : texte Markdown → [{ titre, niveau, html }]
export function decouper(texte, base = '') {
  const { sortie, formules } = extraireFormules(texte);
  const tokens = marked.lexer(sortie);
  corrigerChemins(tokens, base);
  return grouperEnSections(tokens).map(({ titre, niveau, tokens }) => {
    tokens.links = {};
    const html = remettreFormules(marked.parser(tokens), formules)
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
