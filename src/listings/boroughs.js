export const BOROUGHS = {
  manhattan: {
    id: 'manhattan',
    name: 'Manhattan',
    craigslistArea: 'manhattan',
    streeteasySlug: 'manhattan',
  },
  brooklyn: {
    id: 'brooklyn',
    name: 'Brooklyn',
    craigslistArea: 'brooklyn',
    streeteasySlug: 'brooklyn',
  },
  queens: {
    id: 'queens',
    name: 'Queens',
    craigslistArea: 'queens',
    streeteasySlug: 'queens',
  },
  bronx: {
    id: 'bronx',
    name: 'Bronx',
    craigslistArea: 'bronx',
    streeteasySlug: 'bronx',
  },
  staten_island: {
    id: 'staten_island',
    name: 'Staten Island',
    craigslistArea: 'staten island',
    streeteasySlug: 'staten-island',
  },
};

export function resolveBoroughs(selected) {
  if (!selected?.length || selected.includes('all')) {
    return Object.values(BOROUGHS);
  }
  const unknown = selected.filter((b) => !BOROUGHS[b]);
  if (unknown.length) {
    throw new Error(
      `Unknown borough(s): ${unknown.join(', ')}. Choose from: ${Object.keys(BOROUGHS).join(', ')} or 'all'.`,
    );
  }
  return selected.map((id) => BOROUGHS[id]);
}
