'use strict';

const fs = require('fs');

const CHROME_EXTENION_ID = 'hhinaapppaileiechjoiifaancjggfjm';
const FIREFOX_EXTENION_ID = '{799c0914-748b-41df-a25c-22d008f9e83f}';

const SRC_DIR = 'src';
const BUILD_DIR = 'build';

const PACKAGE_FILE = 'web-scrobbler.zip';
const MANIFEST_FILE = 'src/manifest.json';

// Files to build package
const EXTENSION_SRC = [
	'**/*',
	// Skip files
	'!content/testReporter.js', '!icons/src/**',
];
const EXTENSION_DOCS = [
	'README.md', 'LICENSE.md'
];

// Files to lint
const JS_FILES = [
	// Custom Grunt tasks
	'.grunt',
	// Connectors
	`${SRC_DIR}/connectors/**/*.js`,
	// Core files
	`${SRC_DIR}/core/**/*.js`, `${SRC_DIR}/options/*.js`,
	`${SRC_DIR}/popups/*.js`,
	// Tests
	'tests/**/*.js'
];
const JSON_FILES = ['*.json', '.stylelintrc'];
const HTML_FILES = [`${SRC_DIR}/options/*.html`, `${SRC_DIR}/popups/*.html`];
const CSS_FILES = [`${SRC_DIR}options/*.css`, `${SRC_DIR}/popups/*.css`];

const isTravisCi = (process.env.TRAVIS === 'true');

const webStoreConfig = loadWebStoreConfig();
const githubConfig = loadGithubConfig();
const amoConfig = loadAmoConfig();

module.exports = (grunt) => {
	grunt.initConfig({
		manifest: grunt.file.readJSON(MANIFEST_FILE),

		/**
		 * Configs of build tasks.
		 */

		clean: {
			build: BUILD_DIR,
			package: [PACKAGE_FILE],
			chrome: [
				`${BUILD_DIR}/icons/icon128_firefox.png`,
				`${BUILD_DIR}/icons/icon48_firefox.png`
			],
		},
		copy: {
			source_files: {
				expand: true,
				cwd: SRC_DIR,
				src: EXTENSION_SRC,
				dest: BUILD_DIR,
			},
			documentation: {
				expand: true,
				src: EXTENSION_DOCS,
				dest: BUILD_DIR,
			}
		},
		compress: {
			main: {
				options: {
					archive: PACKAGE_FILE,
					pretty: true
				},
				expand: true,
				cwd: BUILD_DIR,
				src: '**/*',
			}
		},
		imagemin: {
			static: {
				options: {
					svgoPlugins: [{
						removeViewBox: false
					}],
				},
				files: [{
					expand: true,
					src: [
						`${BUILD_DIR}/icons/*.svg`,
						`${BUILD_DIR}/icons/*.png`
					]
				}]
			}
		},
		preprocess: {
			firefox: {
				src: `${BUILD_DIR}/**/*.js`,
				expand: true,
				options: {
					inline: true,
					context: {
						FIREFOX: true,
					}
				}
			},
			chrome: {
				src: `${BUILD_DIR}/**/*.js`,
				expand: true,
				options: {
					inline: true,
					context: {
						CHROME: true,
					}
				}
			}
		},
		rename: {
			firefox: {
				files: [{
					src: `${BUILD_DIR}/icons/icon128_firefox.png`,
					dest: `${BUILD_DIR}/icons/icon128.png`
				}, {
					src: `${BUILD_DIR}/icons/icon48_firefox.png`,
					dest: `${BUILD_DIR}/icons/icon48.png`
				}]
			}
		},
		replace_json: {
			chrome: {
				src: `${BUILD_DIR}/manifest.json`,
				changes: {
					'options_ui': undefined,
				}
			},
			firefox: {
				src: `${BUILD_DIR}/manifest.json`,
				changes: {
					'applications.gecko.id': FIREFOX_EXTENION_ID,
					'applications.gecko.strict_min_version': '53.0',

					'options_page': undefined,
				}
			},
		},

		/**
		 * Publish tasks.
		 */

		bump: {
			options: {
				files: [MANIFEST_FILE],
				updateConfigs: ['manifest'],
				commitFiles: [MANIFEST_FILE],
			}
		},
		dump_changelog: {
			token: githubConfig.token,
			version: '<%= manifest.version %>',
		},
		github_publish: {
			token: githubConfig.token,
			version: '<%= manifest.version %>',
		},
		amo_upload: {
			issuer: amoConfig.issuer,
			secret: amoConfig.secret,
			id: FIREFOX_EXTENION_ID,
			version: '<%= manifest.version %>',
			src: PACKAGE_FILE,
		},
		webstore_upload: {
			accounts: {
				default: {
					publish: true,
					client_id: webStoreConfig.clientId,
					client_secret: webStoreConfig.clientSecret,
					refresh_token: webStoreConfig.refreshToken,
				},
			},
			extensions: {
				'web-scrobbler': {
					appID: CHROME_EXTENION_ID,
					zip: PACKAGE_FILE,
				}
			}
		},

		/**
		 * Linter configs.
		 */

		eslint: {
			target: JS_FILES,
			options: {
				configFile: '.eslintrc.js',
				fix: !isTravisCi
			},
		},
		jsonlint: {
			src: JSON_FILES
		},
		lintspaces: {
			src: [JS_FILES, JSON_FILES, CSS_FILES, HTML_FILES],
			options: {
				editorconfig: '.editorconfig',
				ignores: ['js-comments']
			}
		},
		stylelint: {
			all: CSS_FILES
		},

		/**
		 * Configs of other tasks.
		 */

		exec: {
			run_tests: {
				cmd: (...args) => `node tests/runner.js ${args.join(' ')}`
			}
		},
		gitcommit: {
			add0n_changelog: {
				options: {
					message: 'Update changelog on add0n.com'
				},
				files: {
					src: ['.add0n/changelog.json']
				}
			}
		}
	});

	require('load-grunt-tasks')(grunt);
	grunt.loadTasks('.grunt');

	/**
	 * Some tasks take browser name as an argument.
	 * We support only Chrome and Firefox, which can be specified
	 * as 'chrome' and 'firefox' respectively:
	 *
	 *   Build a package for Chrome browser
	 *   > grunt build:chrome
	 *
	 *   Compile sources for Firefox browser
	 *   > grunt compile:firefox
	 */

	/**
	 * Set the extension icon according to specified browser.
	 * @param {String} browser Browser name
	 */
	grunt.registerTask('icons', (browser) => {
		assertBrowserIsSupported(browser);

		switch (browser) {
			case 'chrome':
				grunt.task.run('clean:chrome');
				break;
			case 'firefox':
				grunt.task.run('rename:firefox');
				break;
		}
	});

	/**
	 * Copy source filed to build directory, preprocess them and
	 * set the extension icon according to specified browser.
	 * @param {String} browser Browser name
	 */
	grunt.registerTask('compile', (browser) => {
		assertBrowserIsSupported(browser);

		grunt.task.run([
			'copy', `preprocess:${browser}`,
			`icons:${browser}`, 'imagemin',
			`replace_json:${browser}`
		]);
	});

	/**
	 * Compile source files and package them.
	 * @param  {String} browser Browser name
	 */
	grunt.registerTask('build', (browser) => {
		assertBrowserIsSupported(browser);

		grunt.task.run([
			'clean:build', `compile:${browser}`, 'clean:package',
			'compress', 'clean:build',
		]);
	});

	/**
	 * Publish data.
	 * @param  {String} arg Task argument
	 */
	grunt.registerTask('publish', (arg) => {
		/**
		 * Generate and commit changelog file for add0n.com website.
		 */
		if (arg === 'add0n' || arg === 'addon') {
			grunt.task.run([
				'dump_changelog', 'gitcommit:add0n_changelog'
			]);
			return;
		}

		/**
		 * Create package and publish it.
		 */

		let browser = arg;
		assertBrowserIsSupported(browser);

		switch (browser) {
			case 'chrome':
				grunt.task.run(['build:chrome', 'webstore_upload', 'clean:package']);
				break;
			case 'firefox':
				grunt.task.run(['build:firefox', 'amo_upload', 'clean:package']);
				break;
		}
	});

	/**
	 * Release new version for CI to pickup.
	 *
	 * @param {String} releaseType Release type that 'grunt-bump' supports
	 */
	grunt.registerTask('release', (releaseType) => {
		if (!releaseType) {
			grunt.fail.fatal('You should specify release type!');
		}

		grunt.task.run(`bump-only:${releaseType}`);

		// Patch releases are in vX.X.X branch, so there's no reason
		// to make changelogs for them.
		if (releaseType !== 'patch') {
			grunt.task.run('publish:add0n');
		}

		grunt.task.run('bump-commit');
		grunt.task.run('github_publish');
	});


	/**
	 * Release new version locally and publish all packages.
	 *
	 * @param {String} releaseType Release type that 'grunt-bump' supports
	 */
	grunt.registerTask('release-local', (releaseType) => {
		if (!releaseType) {
			grunt.fail.fatal('You should specify release type!');
		}

		grunt.task.run(`release:${releaseType}`);

		grunt.task.run(['publish:chrome', 'publish:firefox']);
	});

	/**
	 * Run core or connectors tests.
	 *
	 * You can easily run all test by the following command:
	 *   > grunt test
	 *
	 * To run core tests use 'core' as an argument:
	 *   > grunt test:core
	 *
	 * Note: running core and connectors tests at the same time is not supported.
	 *
	 * You can specify tests you want to run as arguments:
	 *   > grunt test:8tracks
	 *   Run single test for 8tracks connector
	 *
	 *   > grunt test:hypem:dashradio
	 *   Run tests for Hype Machine and Dash Radio connectors
	 *
	 * Also, you can use following options:
	 *   - debug: enable debug mode. Disabled by default.
	 *     Use true|on|1 value to enable and false|off|0 to disable debug mode.
	 *   - quitOnEnd: close browser when all tests are completed. Enabled by default.
	 *     Use true|on|1 value to enable and false|off|0 to disable this feature.
	 *   - skip: skip given tests.
	 *     Tests can be specified as string of tests filenames joined by comma.
	 *
	 * Of course, you can mix both options and tests in arguments:
	 *   > grunt test:8tracks:debug=1
	 */
	grunt.registerTask('test', 'Run tests.', function(...args) {
		grunt.task.run([
			`exec:run_tests:${args.join(':')}`
		]);
	});

	/**
	 * Lint source code using linters specified below.
	 */
	grunt.registerTask('lint', [
		'eslint', 'jsonlint', 'lintspaces', 'stylelint'
	]);

	/**
	 * Register default task
	 */
	grunt.registerTask('default', ['lint', 'test:core']);

	/**
	 * Throw an error if the extension doesn't support given browser.
	 * @param  {String}  browser Browser name
	 */
	function assertBrowserIsSupported(browser) {
		const supportedBrowsers = ['chrome', 'firefox'];

		if (!browser) {
			grunt.fail.fatal(
				'You have not specified browser.\n' +
				`Currently supported browsers: ${supportedBrowsers.join(', ')}.`
			);
		}

		if (supportedBrowsers.indexOf(browser) === -1) {
			grunt.fail.fatal(`Unknown browser: ${browser}`);
		}
	}
};

/**
 * Get JSON config.
 *
 * @param  {String} configPath Path to config file
 * @return {Object} Config object
 */
function loadConfig(configPath) {
	if (fs.existsSync(configPath)) {
		return require(configPath);
	}

	return {};
}

/**
 * Get web store config.
 *
 * @return {Object} Config object
 */
function loadWebStoreConfig() {
	if (isTravisCi) {
		return {
			clientId: process.env.CHROME_CLIENT_ID,
			clientSecret: process.env.CHROME_CLIENT_SECRET,
			refreshToken: process.env.CHROME_REFRESH_TOKEN
		};
	}

	return loadConfig('./.publish/web-store.json');
}

/**
 * Get github config.
 *
 * @return {Object} Config object
 */
function loadGithubConfig() {
	if (isTravisCi) {
		return {
			token: process.env.GITHUB_TOKEN,
		};
	}

	return loadConfig('./.publish/github.json');
}

/**
 * Get Amo config.
 *
 * @return {Object} Config object
 */
function loadAmoConfig() {
	if (isTravisCi) {
		return {
			issuer: process.env.AMO_ISSUER,
			secret: process.env.AMO_SECRET,
		};
	}

	return loadConfig('./.publish/amo.json');
}
