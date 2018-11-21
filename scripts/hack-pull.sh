#!/bin/bash

# This tries to copy the relevant files from ../potassium-test/ into the respective node_modules dir
# It's handy during development

cp -r ../potassium-test/src/* node_modules/potassium-test/src/
