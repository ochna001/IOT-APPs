<#
Initializes a git repo and prepares it for first push. It runs the commands you supplied but does not perform the push.
Usage: .\scripts\git-init-repo.ps1
#>

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git not found on PATH. Install Git and re-run this script."
  exit 1
}

git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/ochna001/IOT-APPs.git

Write-Output "Remote configured. To push to GitHub run:" 
Write-Output "git push -u origin main"
