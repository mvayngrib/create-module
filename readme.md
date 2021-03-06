# create-module
[![NPM](https://nodei.co/npm/create-module.png)](https://nodei.co/npm/create-module/)

Helper tool for the usual steps to create a module:

## Usage
```
create-module <package> [--check]
```

Does the following work-flow:
```sh
mkdir <package>
cd <package>
# create <githubrepo> for <package>
git init
git remote add origin <githubrepo>
echo <readme> > readme.md
echo node_modules > .gitignore
npm init
# install default dev deps for style, testing, and pre-commit checks
# also adds style+test checks to pre-commit
npm install --save-dev standard tape pre-commit
git add --all
git commit -m "initial commit"
git push origin master
# set github repo description to package.json description
```

if the 'check' flag is used, it will check npm to see if module exists.

The readme.md is initialised with this template:

```md
# <package>
[![NPM](https://nodei.co/npm/<package>.png)](https://nodei.co/npm/<package>/)

```
