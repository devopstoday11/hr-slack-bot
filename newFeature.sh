#! /bin/bash
echo "Type the new feature name, followed by [ENTER]:"
read feature
touch messages/$feature.js
touch models/$feature.js
touch schemas/$feature.js
touch services/$feature.js

