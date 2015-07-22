var fs = require('fs')
var path = require('path')
var request = require('request')
var exec = require('child_process').exec
var spawn = require('child_process').spawn
var series = require('run-series')
var parallel = require('run-parallel')
var stringify = require('json-stable-stringify')
var base = 'https://api.github.com'
var registry = 'https://registry.npmjs.org'

module.exports = createModule

var readmeTemplate = '# <package>\n[![NPM](https://nodei.co/npm/<package>.png)](https://nodei.co/npm/<package>/)\n'
var TEST_TEMPLATE = 'var test = require(\'tape\')\n\n' +
                    'test(\'dummy test\', function (t) {\n  t.end()\n})'

function createModule(name, token, options, cb) {
  var headers = {"user-agent": "npm create-module"}
  var dir = path.join(process.cwd(), name)
  headers['Authorization'] = 'token ' + token
  var input = {
    name: name
  }

  var repo
  var processList = [
    createGitHubrepo,
    createDir,
    gitInit,
    createReadme,
    createGitignore,
    npmInit,
    parallel.bind(null, [editPackage, addTest]),
    parallel.bind(null, [gitPush, changeDescription, npmInstall])
  ]

  if (options.check !== undefined) {
    console.log('Checking npm for pre-existing module name')
    processList.unshift(checkName)
  }

  series(processList, function (err) {
    if(err) console.error('Error: ' + err.message)
    else console.log('Done.')
  })

  function checkName(fn) {
    request.head(registry + '/' + name, { headers: headers }, function (err, res) {
      if (err) return fn(err)
      if (res.statusCode === 200) return fn(new Error('"' + name + '" is already taken on npm.'))
      fn(null)
    })
  }

  function createGitHubrepo(cb) {
    console.log('Creating GitHub repo..')
    request.post(base + '/user/repos', {json: input, headers: headers}, function (err, res, repository) {
      if(err) return cb(err)
      repo = repository
      console.log('Created repo', repo.full_name)
      cb(null, repo)
    })
  }

  function createDir(cb) {
    console.log('Creating directory ' + dir)
    fs.mkdir(dir, cb)
  }

  function gitInit(cb) {
    console.log('Initialize git..')
    exec('git init && git remote add origin ' + repo.clone_url, {cwd: dir}, function (err, stdo, stde) {
      process.stderr.write(stde)
      cb(err)
    })
  }

  function createReadme(cb) {
    console.log('Create readme.md...')
    fs.writeFile(path.join(dir, 'readme.md'), readmeTemplate.replace(/<package>/g, name), cb)
  }

  function createGitignore(cb) {
    console.log('Create .gitignore...')
    fs.writeFile(path.join(dir, '.gitignore'), 'node_modules\n', cb)
  }

  function npmInit(cb) {
    var init = spawn('npm', ['init'], {cwd: dir, stdio: [process.stdin, 'pipe', 'pipe']})
    init.stdout.pipe(process.stdout)
    init.stderr.pipe(process.stderr)
    init.on('close', function (code) {
      var err
      if (code > 0) err = new Error('Failed npm init')

      cb(err)
    })
  }

  function changeDescription (cb) {
    input.description = require(path.join(dir, 'package.json')).description
    var repoUrl = [base, 'repos', repo.full_name].join('/')
    request.patch(repoUrl, { json: input, headers: headers }, cb)
  }

  function editPackage (cb) {
    var pkgPath = path.join(dir, 'package.json')
    var pkg = require(pkgPath)
    if (options.check) pkg.private = true

    pkg.scripts.style = 'standard $(git ls-files "**.js")'
    pkg['pre-commit'] = [
      'style',
      'test'
    ]

    if (!pkg.scripts.test || pkg.scripts.test.indexOf('Error: no test specified') !== -1) {
      pkg.scripts.test = 'node test'
    }

    pkg.devDependencies = {
      'pre-commit': 'latest',
      'standard': 'latest',
      'tape': 'latest'
    }

    fs.writeFile(pkgPath, stringify(pkg, { space: '  ' }), cb)
  }

  function addTest (cb) {
    fs.mkdir(path.join(dir, 'test'), function (err) {
      if (err) cb(err)

      fs.writeFile(
        path.join(dir, 'test', 'index.js'),
        TEST_TEMPLATE,
        cb
      )
    })
  }

  function npmInstall(cb) {
    var install = spawn('npm', ['install'], {cwd: dir, stdio: [process.stdin, 'pipe', 'pipe']})
    install.stdout.pipe(process.stdout)
    install.stderr.pipe(process.stderr)
    install.on('close', function (code) {
      var err
      if (code > 0) err = new Error('Failed npm init')

      cb(err)
    })
  }

  function gitPush(cb) {
    console.log('Commit and push to GitHub')
    var finishGit = [
      'git add --all',
      'git commit -m "Initial commit"',
      'git push origin master'
    ]
    exec(finishGit.join(' && '), {cwd: dir}, function (err, stdo, stde) {
      process.stderr.write(stde)
      cb(err)
    })
  }
}
