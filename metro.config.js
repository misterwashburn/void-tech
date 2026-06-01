const { getDefaultConfig } = require('expo/metro-config');
const { checkExpoAv } = require('./scripts/check-expo-av');

checkExpoAv({ exitOnMissing: true });

const config = getDefaultConfig(__dirname);

module.exports = config;
