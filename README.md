# flavio
Really simple package manager for your own private packages hosted on any git server. No registry or server hosting required. Can be used in conjunction with bower/npm

## Usage

### Add flavio support to an existing project

Add a flavio.json file to the root of your project using the init command

```
flavio init
```

it looks similar to package.json / bower.json:

```
{
  "name": "my-project",
  "version": "0.1.0-snapshot.0"
}
```

You can then either add dependencies using the 'add' command: (Dependencies by default are stored in a "flavio_components" folder)

```
flavio add My_Dependency https://github.com/peteward44/gulp-directory-sync.git
```

Or add them manually to the json file, then running the update command:

```
{
  "name": "my-project",
  "version": "0.1.0-snapshot.0",
  "dependencies": {
    "My_Dependency": "https://github.com/username/my_dependency#master"
  }
}
```

```
flavio update
```

### Clone repository

Default clone (defaults to master branch)

```
flavio clone https://github.com/username/repo.git
```

Clone a specific branch, add #branch_name to end of URL in the same way bower does

```
flavio clone https://github.com/username/repo.git#my_branch
```

You can do the same for a tag

```
flavio clone https://github.com/username/repo.git#1.0.0
```

### Update an already cloned repository

Update from root directory of project

```
flavio update
```

Update from another directory

```
flavio update --cwd=/home/me/repo
```

### Print status

```
flavio status
```

Outputs something like

```
Repository         Target  Up to date?  Conflicts?  Local changes?  URL
-----------------  ------  -----------  ----------  --------------  ------------------------------------------------------------------------
My_Project         master  YES          CLEAN       CHANGES         https://github.com/username/my_project#master
My_Dependency1     master  YES          CLEAN       CLEAN           https://github.com/username/my_dependency1#master
My_Dependency2     master  YES          CLEAN       CHANGES         https://github.com/username/my_dependency2#master
```

### Tag a repository

Flavio will create tags for your main project and all your dependencies. It uses the version number, stripped of the "snapshot" prerelease tag in the flavio.json as the tag name.
It requires write access to the master branch of the repositories to successfully complete, as it increments the version number on the master branch.

```
flavio tag
```

You can tag an individual dependency (and any of it's dependencies) using the "tagdep" command.

```
flavio tagdep My_Dependency1
```

You can also specify a tag name to use with both commands if desired.

```
flavio tag 1.5.2
flavio tagdep My_Dependency1 8.4.2
```

If you wish to specify the tag names of the dependencies that are automatically tagged, you can specify them using the ```--versions``` argument. You can repeat the ```--versions``` parameter as many times as necessary.

```
flavio tag --versions My_Dependency1=8.4.2 --versions My_Dependency2=4.2.6
flavio tagdep 5.2.4 --versions My_Dependency1=8.4.2 --versions My_Dependency2=4.2.6
```

If you have a lot of dependencies, you can specify a filename which points to a JSON file containing this version information for dependencies:

```
flavio tag --input my_file.json
```

my_file.json looks like:

```
{
   "My_Dependency1": "8.4.2",
   "My_Dependency2": "4.2.6"
}
```

### Execute a git command on main project and dependencies

Sometimes it may be useful to execute the same command on all dependencies - e.g. a git clean:

```
flavio execute -- clean -fdx
```

### Export all files to another directory

If you want to export files stored in git to another directory:

```
flavio export /home/user/my_export_directory
```

### The dependency cache

Flavio by default clones dependency repositories into a shared directory and then creates symbolic links to them from the flavio_modules directory. To disable this behaviour, use the ```--link=false``` command line argument.

To clear all dependencies connected to a project, execute a clear command in the root folder:
```
flavio clear
```

To clear all dependencies for every project, use the clearall command:
```
flavio clearall
```
