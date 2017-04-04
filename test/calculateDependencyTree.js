import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';
import calculateDependencyTree from '../lib/calculateDependencyTree.js';


describe(`calculateDependencyTree tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('calculateDependencyTree basic', async (tempDir) => {
		const result = await git.addProject( tempDir, {
			name: 'main',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'this is on the main project'
				}
			],
			modules: [
				{
					name: 'main2',
					version: '0.2.0-snapshot.0',
					files: [
						{
							path: 'file2.txt',
							contents: 'this is on the main2 project'
						}
					]
				}
			]
		} );
		
		const tree = await calculateDependencyTree( { cwd: result.checkoutDir } );
		chai.assert.ok( !!tree );
		// TODO: assert
/* result should look like
{
        "status": "normal",
        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\0fa26f39-45c7-4b0d-a541-d7848c1332de\\b45477d9-90ca-4420-87b6-06815bae4433#master",
        "caliberJson": {
                "name": "main",
                "version": "0.1.0-snapshot.0",
                "dependencies": {
                        "main2": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\0fa26f39-45c7-4b0d-a541-d7848c1332de\\5286761e-03c0-4f07-b25f-aa6f752c3af8#master"
                }
        },
        "children": [
                [
                        "main2",
                        {
                                "status": "normal",
                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\0fa26f39-45c7-4b0d-a541-d7848c1332de\\5286761e-03c0-4f07-b25f-aa6f752c3af8#master",
                                "caliberJson": {
                                        "name": "main2",
                                        "version": "0.2.0-snapshot.0",
                                        "dependencies": {}
                                },
                                "children": []
                        }
                ]
        ]
}
*/
	});

	helpers.test('calculateDependencyTree more complicated tree', async (tempDir) => {
		const result = await git.addProject( tempDir, {
			name: 'main',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'this is on the main project'
				}
			],
			modules: [
				{
					name: 'main2',
					version: '0.2.0-snapshot.0',
					files: [
						{
							path: 'file2.txt',
							contents: 'this is on the main2 project'
						}
					],
					modules: [
						{
							name: 'main3',
							version: '0.3.0-snapshot.0',
							files: [
								{
									path: 'file3.txt',
									contents: 'this is on the main3 project'
								}
							],
							modules: [
								{
									name: 'main4',
									version: '0.4.0-snapshot.0',
									files: [
										{
											path: 'file4.txt',
											contents: 'this is on the main4 project'
										}
									]
								}
							]
						}
					]
				},
				{
					name: 'main5',
					version: '0.5.0-snapshot.0',
					files: [
						{
							path: 'file5.txt',
							contents: 'this is on the main5 project'
						}
					],
					modules: [
						{
							name: 'main6',
							version: '0.6.0-snapshot.0',
							files: [
								{
									path: 'file6.txt',
									contents: 'this is on the main6 project'
								}
							]
						}
					]
				}
			]
		} );
		
		const tree = await calculateDependencyTree( { cwd: result.checkoutDir } );
		chai.assert.ok( !!tree );
/* result should look like
{
        "status": "normal",
        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\ea4d5a8c-fecf-41ee-aeaa-fe2aa1e4b61f#master",
        "caliberJson": {
                "name": "main",
                "version": "0.1.0-snapshot.0",
                "dependencies": {
                        "main2": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\3e020a9d-3bce-4054-9223-5ffcac185f8b#master",
                        "main5": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\5facbbfb-5711-4508-ba40-cc636d6695c4#master"
                }
        },
        "children": [
                [
                        "main2",
                        {
                                "status": "normal",
                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\3e020a9d-3bce-4054-9223-5ffcac185f8b#master",
                                "caliberJson": {
                                        "name": "main2",
                                        "version": "0.2.0-snapshot.0",
                                        "dependencies": {
                                                "main3": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\7255f316-1b92-4713-8e6d-f9cb5a14de30#master"
                                        }
                                },
                                "children": [
                                        [
                                                "main3",
                                                {
                                                        "status": "normal",
                                                        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\7255f316-1b92-4713-8e6d-f9cb5a14de30#master",
                                                        "caliberJson": {
                                                                "name": "main3",
                                                                "version": "0.3.0-snapshot.0",
                                                                "dependencies": {
                                                                        "main4": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\e0ccc00d-e2bc-4de9-9b23-6abe78aaca63#master"
                                                                }
                                                        },
                                                        "children": [
                                                                [
                                                                        "main4",
                                                                        {
                                                                                "status": "normal",
                                                                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\e0ccc00d-e2bc-4de9-9b23-6abe78aaca63#master",
                                                                                "caliberJson": {
                                                                                        "name": "main4",
                                                                                        "version": "0.4.0-snapshot.0",
                                                                                        "dependencies": {}
                                                                                },
                                                                                "children": []
                                                                        }
                                                                ]
                                                        ]
                                                }
                                        ]
                                ]
                        }
                ],
                [
                        "main5",
                        {
                                "status": "normal",
                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\5facbbfb-5711-4508-ba40-cc636d6695c4#master",
                                "caliberJson": {
                                        "name": "main5",
                                        "version": "0.5.0-snapshot.0",
                                        "dependencies": {
                                                "main6": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\8affa5b2-d000-4801-b435-d972c0499dc8#master"
                                        }
                                },
                                "children": [
                                        [
                                                "main6",
                                                {
                                                        "status": "normal",
                                                        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\8affa5b2-d000-4801-b435-d972c0499dc8#master",
                                                        "caliberJson": {
                                                                "name": "main6",
                                                                "version": "0.6.0-snapshot.0",
                                                                "dependencies": {}
                                                        },
                                                        "children": []
                                                }
                                        ]
                                ]
                        }
                ]
        ]
}
*/
	});
	

	helpers.test('calculateDependencyTree add repo on CLI', async (tempDir) => {
		const result = await git.addProject( tempDir, {
			name: 'main',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'this is on the main project'
				}
			],
			modules: [
				{
					name: 'main2',
					version: '0.2.0-snapshot.0',
					files: [
						{
							path: 'file2.txt',
							contents: 'this is on the main2 project'
						}
					]
				}
			]
		} );
		const result2 = await git.addProject( tempDir, {
			name: 'main3',
			version: '0.3.0-snapshot.0',
			files: [
				{
					path: 'file3.txt',
					contents: 'this is on the main3 project'
				}
			],
			modules: [
				{
					name: 'main4',
					version: '0.4.0-snapshot.0',
					files: [
						{
							path: 'file4.txt',
							contents: 'this is on the main4 project'
						}
					]
				}
			]
		} );
		
		const tree = await calculateDependencyTree( { cwd: result.checkoutDir }, [`${result2.repoDir}#master`] );
		chai.assert.ok( !!tree );
		//console.log( "Tree", JSON.stringify( tree, null, '\t' ) );
		// TODO: assert
/* result should look like
{
        "installed": true,
        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\599474f6-885d-4d18-afc7-b01a36002092\\218fcdcc-2bfa-4f61-a314-0367f68476a3#master",
        "caliberJson": {
                "name": "main",
                "version": "0.1.0-snapshot.0",
                "dependencies": {
                        "main2": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\599474f6-885d-4d18-afc7-b01a36002092\\5b6c22b3-4a48-4e98-8933-1f1ef06affde#master"
                }
        },
        "children": [
                [
                        "main2",
                        {
                                "installed": false,
                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\599474f6-885d-4d18-afc7-b01a36002092\\5b6c22b3-4a48-4e98-8933-1f1ef06affde#master",
                                "caliberJson": {
                                        "name": "main2",
                                        "version": "0.2.0-snapshot.0",
                                        "dependencies": {}
                                },
                                "children": []
                        }
                ],
                [
                        "main3",
                        {
                                "installed": false,
                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\599474f6-885d-4d18-afc7-b01a36002092\\72350852-cc85-4815-a11e-bf8689c9db0e#master",
                                "caliberJson": {
                                        "name": "main3",
                                        "version": "0.3.0-snapshot.0",
                                        "dependencies": {
                                                "main4": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\599474f6-885d-4d18-afc7-b01a36002092\\872eff89-453f-4aad-8a1c-acb623d38524#master"
                                        }
                                },
                                "children": [
                                        [
                                                "main4",
                                                {
                                                        "installed": false,
                                                        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\caliber\\599474f6-885d-4d18-afc7-b01a36002092\\872eff89-453f-4aad-8a1c-acb623d38524#master",
                                                        "caliberJson": {
                                                                "name": "main4",
                                                                "version": "0.4.0-snapshot.0",
                                                                "dependencies": {}
                                                        },
                                                        "children": []
                                                }
                                        ]
                                ]
                        }
                ]
        ]
}
*/
	});
});
