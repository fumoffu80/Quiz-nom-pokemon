@echo off
echo Creation du dossier sprites\pokemon...
mkdir sprites\pokemon 2>nul
cd sprites\pokemon
echo Telechargement de 1025 images depuis PokeAPI...
FOR /L %%i IN (1, 1, 1025) DO (
  if not exist %%i.png (
    curl -s -o %%i.png https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/%%i.png
    echo %%i.png OK
  )
)
echo Termine!
pause