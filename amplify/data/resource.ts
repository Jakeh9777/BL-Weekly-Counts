import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Account: a.model({
    name: a.string().required(),
    products: a.hasMany('AccountProduct', 'accountId'), 
  }).authorization(allow => [allow.publicApiKey()]),

  MasterProduct: a.model({
    name: a.string().required(),
    defaultOrder: a.integer(),
  }).authorization(allow => [allow.publicApiKey()]),

  AccountProduct: a.model({
    accountId: a.id().required(),
    account: a.belongsTo('Account', 'accountId'),
    masterProductId: a.id().required(),
    masterProduct: a.belongsTo('MasterProduct', 'masterProductId'),
  }).authorization(allow => [allow.publicApiKey()]),

  Entry: a.model({
    date: a.date().required(),
    value: a.integer().required(),
    accountId: a.id().required(),
    productId: a.id().required(),
  }).authorization(allow => [allow.publicApiKey()]),

  AppUser: a.model({
    name: a.string().required(),
    pin: a.string().required(),
    isAdmin: a.boolean().default(false),
  }).authorization(allow => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 30 }
  },
});