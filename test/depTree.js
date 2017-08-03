import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';
import * as depTree from '../lib/depTree.js';


describe(`depTree tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.testSkip('basic', async (tempDir) => {
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
		
		const tree = await depTree.calculate( { cwd: result.checkoutDir } );
		chai.assert.ok( !!tree );
		// TODO: assert
/* result should look like
{
  "installed": true,
  "dir": "C:\\Users\\PETE~1.WAR\\AppData\\Local\\Temp\\flavio\\6f368412-db00-45f9-ab05-1c9c90e14287\\cf8e5916-b8b5-476a-b16e-7d6ce4df9b93",
  "repo": "C:\\Users\\PETE~1.WAR\\AppData\\Local\\Temp\\flavio\\6f368412-db00-45f9-ab05-1c9c90e14287\\2ebdd847-71ca-4878-8441-52c46017a6cb#master",
  "flavioJson": {
    "name": "main",
    "version": "0.1.0-snapshot.0",
    "dependencies": {
      "main2": "C:\\Users\\PETE~1.WAR\\AppData\\Local\\Temp\\flavio\\6f368412-db00-45f9-ab05-1c9c90e14287\\c5961e48-064a-45b5-8d39-dc9c928f6946#master"
    }
  },
  "children": [
    [
      "main2",
      {
        "installed": false,
        "dir": "C:\\Users\\PETE~1.WAR\\AppData\\Local\\Temp\\flavio\\6f368412-db00-45f9-ab05-1c9c90e14287\\cf8e5916-b8b5-476a-b16e-7d6ce4df9b93\\flavio_modules\\main2",
        "repo": "C:\\Users\\PETE~1.WAR\\AppData\\Local\\Temp\\flavio\\6f368412-db00-45f9-ab05-1c9c90e14287\\c5961e48-064a-45b5-8d39-dc9c928f6946#master",
        "flavioJson": {
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

	helpers.testSkip('more complicated tree', async (tempDir) => {
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
		
		const tree = await depTree.calculate( { cwd: result.checkoutDir } );
		chai.assert.ok( !!tree );
		console.log( "tree", JSON.stringify( tree, null, 2 ) );
/* result should look like
{
        "status": "normal",
        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\ea4d5a8c-fecf-41ee-aeaa-fe2aa1e4b61f#master",
        "flavioJson": {
                "name": "main",
                "version": "0.1.0-snapshot.0",
                "dependencies": {
                        "main2": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\3e020a9d-3bce-4054-9223-5ffcac185f8b#master",
                        "main5": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\5facbbfb-5711-4508-ba40-cc636d6695c4#master"
                }
        },
        "children": [
                [
                        "main2",
                        {
                                "status": "normal",
                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\3e020a9d-3bce-4054-9223-5ffcac185f8b#master",
                                "flavioJson": {
                                        "name": "main2",
                                        "version": "0.2.0-snapshot.0",
                                        "dependencies": {
                                                "main3": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\7255f316-1b92-4713-8e6d-f9cb5a14de30#master"
                                        }
                                },
                                "children": [
                                        [
                                                "main3",
                                                {
                                                        "status": "normal",
                                                        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\7255f316-1b92-4713-8e6d-f9cb5a14de30#master",
                                                        "flavioJson": {
                                                                "name": "main3",
                                                                "version": "0.3.0-snapshot.0",
                                                                "dependencies": {
                                                                        "main4": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\e0ccc00d-e2bc-4de9-9b23-6abe78aaca63#master"
                                                                }
                                                        },
                                                        "children": [
                                                                [
                                                                        "main4",
                                                                        {
                                                                                "status": "normal",
                                                                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\e0ccc00d-e2bc-4de9-9b23-6abe78aaca63#master",
                                                                                "flavioJson": {
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
                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\5facbbfb-5711-4508-ba40-cc636d6695c4#master",
                                "flavioJson": {
                                        "name": "main5",
                                        "version": "0.5.0-snapshot.0",
                                        "dependencies": {
                                                "main6": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\8affa5b2-d000-4801-b435-d972c0499dc8#master"
                                        }
                                },
                                "children": [
                                        [
                                                "main6",
                                                {
                                                        "status": "normal",
                                                        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\21ca82f1-0310-40ea-bce2-63ac82b728ba\\8affa5b2-d000-4801-b435-d972c0499dc8#master",
                                                        "flavioJson": {
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
	

	helpers.testSkip('add repo on CLI', async (tempDir) => {
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
		
		const tree = await depTree.calculate( { cwd: result.checkoutDir }, [`${result2.repoDir}#master`] );
		chai.assert.ok( !!tree );
		//console.log( "Tree", JSON.stringify( tree, null, '\t' ) );
		// TODO: assert
/* result should look like
{
        "installed": true,
        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\599474f6-885d-4d18-afc7-b01a36002092\\218fcdcc-2bfa-4f61-a314-0367f68476a3#master",
        "flavioJson": {
                "name": "main",
                "version": "0.1.0-snapshot.0",
                "dependencies": {
                        "main2": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\599474f6-885d-4d18-afc7-b01a36002092\\5b6c22b3-4a48-4e98-8933-1f1ef06affde#master"
                }
        },
        "children": [
                [
                        "main2",
                        {
                                "installed": false,
                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\599474f6-885d-4d18-afc7-b01a36002092\\5b6c22b3-4a48-4e98-8933-1f1ef06affde#master",
                                "flavioJson": {
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
                                "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\599474f6-885d-4d18-afc7-b01a36002092\\72350852-cc85-4815-a11e-bf8689c9db0e#master",
                                "flavioJson": {
                                        "name": "main3",
                                        "version": "0.3.0-snapshot.0",
                                        "dependencies": {
                                                "main4": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\599474f6-885d-4d18-afc7-b01a36002092\\872eff89-453f-4aad-8a1c-acb623d38524#master"
                                        }
                                },
                                "children": [
                                        [
                                                "main4",
                                                {
                                                        "installed": false,
                                                        "repo": "C:\\Users\\pete\\AppData\\Local\\Temp\\flavio\\599474f6-885d-4d18-afc7-b01a36002092\\872eff89-453f-4aad-8a1c-acb623d38524#master",
                                                        "flavioJson": {
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

	helpers.testSkip('depTree.listConflicts', async (tempDir) => {
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
							version: '0.5.0-snapshot.0'
						}
					]
				},
				{
					name: 'main4',
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
							version: '0.5.0-snapshot.0'
						}
					]
				}
			]
		} );
		
		const tree = await depTree.calculate( { cwd: result.checkoutDir } );
		chai.assert.ok( !!tree );
		const conflicts = await depTree.listConflicts( tree );
		console.log( "conflicts", conflicts );
	});
});
