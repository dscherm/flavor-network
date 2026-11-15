/** The checked-in curation tables, bundled (the browser path). Node scripts read the JSON with fs. */
import aliases from './aliases.json' with { type: 'json' };
import hidden from './hidden.json' with { type: 'json' };
import packaged from './packaged.json' with { type: 'json' };
import categoryOverrides from './categoryOverrides.json' with { type: 'json' };
import tasteOverrides from './tasteOverrides.json' with { type: 'json' };
import additions from './additions.json' with { type: 'json' };
import categoryRenames from './categoryRenames.json' with { type: 'json' };
import vocabulary from './vocabulary.json' with { type: 'json' };

export const CURATION_TABLES = { aliases, hidden, packaged, categoryOverrides, tasteOverrides, additions, categoryRenames, vocabulary };
