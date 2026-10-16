export default {
  '{apps,packages}/**/*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{js,mjs,cjs}': ['prettier --write'],
  '{apps,packages}/**/*.{json,css,html}': ['prettier --write'],
};
