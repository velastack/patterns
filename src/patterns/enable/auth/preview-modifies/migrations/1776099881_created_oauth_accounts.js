/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const collection = new Collection({
			createRule: null,
			deleteRule: null,
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text3208210256',
					max: 15,
					min: 15,
					name: 'id',
					pattern: '^[a-z0-9]+$',
					presentable: false,
					primaryKey: true,
					required: true,
					system: true,
					type: 'text'
				},
				{
					cascadeDelete: false,
					collectionId: '_pb_users_auth_',
					hidden: false,
					id: 'relation2375276105',
					maxSelect: 1,
					minSelect: 0,
					name: 'user',
					presentable: false,
					required: true,
					system: false,
					type: 'relation'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text1044722854',
					max: 0,
					min: 0,
					name: 'providerId',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: true,
					system: false,
					type: 'text'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text2462348188',
					max: 0,
					min: 0,
					name: 'provider',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: true,
					system: false,
					type: 'text'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text889886754',
					max: 0,
					min: 0,
					name: 'accessToken',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text1769204838',
					max: 0,
					min: 0,
					name: 'refreshToken',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text2192111876',
					max: 0,
					min: 0,
					name: 'avatarURL',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					hidden: false,
					id: 'date951064219',
					max: '',
					min: '',
					name: 'expiry',
					presentable: false,
					required: false,
					system: false,
					type: 'date'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text3885137012',
					max: 0,
					min: 0,
					name: 'email',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text1579384326',
					max: 0,
					min: 0,
					name: 'name',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text4166911607',
					max: 0,
					min: 0,
					name: 'username',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					hidden: false,
					id: 'json1646549047',
					maxSize: 0,
					name: 'rawUser',
					presentable: false,
					required: false,
					system: false,
					type: 'json'
				}
			],
			id: 'pbc_3445581863',
			indexes: [],
			listRule: '@request.auth.id = user.id',
			name: 'oauth_accounts',
			system: false,
			type: 'base',
			updateRule: null,
			viewRule: '@request.auth.id = user.id'
		});

		return app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('pbc_3445581863');

		return app.delete(collection);
	}
);
