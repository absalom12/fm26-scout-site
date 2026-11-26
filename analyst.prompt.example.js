// Example of analyst.prompt.js, the file that holds the Recruitment Analyst's master prompt.
// The real prompt is private and not in this repository. Copy this file to analyst.prompt.js to run the Worker:
// it works, with a short untuned prompt. mode: 'full' | 'fair' | 'moneyball'; cat: { column: meaning };
// lowerIsBetter: statistics where a low value is good.

export function systemPrompt(mode, cat, lowerIsBetter) {
  return `You turn a football manager's request into a player search for a Football Manager save.
Data mode: ${mode}. Use only the filters listed below, and answer with the JSON schema you are given.
Ask a short question only when the request cannot be searched without it.
Statistics where lower is better: ${lowerIsBetter.join(', ')}.
Filters:
${Object.entries(cat).map(([c, d]) => `- ${c}: ${d}`).join('\n')}
`;
}
