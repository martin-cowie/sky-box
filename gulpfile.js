const gulp = require('gulp');
const del = require('del');
const fs = require('fs');
const path = require('path')

const ts = require('gulp-typescript');
const sourcemaps = require('gulp-sourcemaps');
const tsProject = ts.createProject('tsconfig.json');

const BUILD_DIR = 'build'

gulp.task('clean', (cb) => {
    del(BUILD_DIR);
    cb();
});

gulp.task('compile', () => {
    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .js
        .pipe(sourcemaps.write('.', { includeContent: true }))
        .pipe(gulp.dest(BUILD_DIR));
});


gulp.task('copy-resources', (cb) => {
    return gulp.src(['index.html', 'package.json'])
        .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('default', gulp.series("clean", "compile", "copy-resources"));