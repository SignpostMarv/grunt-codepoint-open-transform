/*
 * grunt-codepoint-open-transform
 * https://github.com/SignpostMarv/grunt-codepoint-open-transform
 *
 * Copyright (c) 2015 SignpostMarv
 * Licensed under the MIT license.
 */


module.exports = function(grunt){
    'use strict';
    grunt.registerMultiTask(
        'codepoint_open_transform',
        'Transforms the Ordnance Survey "Code-Point Open" data.',
        function(){
            var
                options = this.options({
                    headers: 1,
                }),
                sources = {},
                headers = {},
                csvFiles = {},
                zipfile = module.require('zipfile'),
                csvParse = module.require('csv-parse'),
                jsonfile = module.require('jsonfile'),
                csvParser
            ;

            if(typeof(options.headers) !== 'number'){
                grunt.log.warn("options.headers must be a number.");
                return false;
            }else if(options.headers < 0){
                grunt.log.warn("options.headers must be greater than zero.");
            }

            // Iterate over all specified file groups.
            this.files.forEach(function(f){
                // Concat specified files.
                var
                    src = f.src.filter(function(filepath){
                        // Warn on and remove invalid source files
                        if (!grunt.file.exists(filepath)){
                            grunt.log.warn(
                                'Source file "' + filepath + '" not found.'
                            );
                            return false;
                        }else{
                            return true;
                        }
                    })[0],
                    generate_json_ooa = false,
                    generate_json_aoo = false
                ;
                if(/\.ooa\.json$/.test(f.dest) || /^ooa\.json$/.test(f.dest)){
                    generate_json_ooa = true;
                }else if(
                    /\.aoo\.json$/.test(f.dest) ||
                    /^aoo\.json$/.test(f.dest)
                ){
                    generate_json_aoo = true;
                }

                if(
                    generate_json_ooa === false &&
                    generate_json_aoo === false
                ){
                    grunt.log.warn(
                        'Unsupported file format specified: ' + f.dest
                    );
                    return false;
                }

                if(!(src in sources)){
                    sources[src] = new zipfile.ZipFile(src);
                    grunt.log.write('Checking File Contents of ' + src + "\n");
                    if(sources[src].names.indexOf('Data/CSV/') === -1){
                        grunt.log.warn('CSV Files Not Found!');
                        return false;
                    }else if(
                        sources[src].names.indexOf(
                            'Doc/Code-Point_Open_Column_Headers.csv'
                        ) === -1
                    ){
                        grunt.log.warn('Could not find CSV Header!');
                        return false;
                    }
                    grunt.log.write(
                        'Building list of CSV files for ' + src + "\n"
                    );
                    csvFiles[src] = sources[src].names.filter(function(e){
                        return /^Data\/CSV\/[a-z]{2}\.csv$/.test(e);
                    });
                    csvParser = csvParse({delimeter: ','});
                    headers[src] = [];
                    csvParser.on('readable', function(){
                        var
                            record = []
                        ;
                        while(record = csvParser.read()){
                            headers[src].push(record);
                        }
                    });
                    csvParser.write(
                        sources[src].readFileSync(
                            'Doc/Code-Point_Open_Column_Headers.csv'
                        )
                    );
                    csvParser.end();
                    if(options.headers >= headers[src].length){
                        grunt.log.warn(
                            'Cannot use options.headers[' +
                            options.headers +
                            ']'
                        );
                        return false;
                    }
                }

                if(generate_json_ooa || generate_json_aoo){
                    grunt.log.write(
                        'Building JSON Data for ' + f.dest + "\n"
                    );
                    var
                        ooa = {},
                        aoo = []
                    ;
                    if(generate_json_ooa){
                        headers[src][options.headers].forEach(function(header){
                            ooa[header] = [];
                        });
                    }
                    csvParser = csvParse({delimeter: ','});
                    csvParser.on('readable', function(){
                        var
                            record = [],
                            ooaAppendRecord = function(e, i){
                                ooa[
                                    headers[src][options.headers][i]
                                ].push(e);
                            },
                            make_aooAppendRecord = function(rowObj){
                                return function(e, i){
                                    rowObj[e] = record[i];
                                };
                            }
                        ;
                        if(generate_json_ooa){
                            while(record = csvParser.read()){
                                record.forEach(ooaAppendRecord);
                            }
                        }else if(generate_json_aoo){
                            while(record = csvParser.read()){
                                var
                                    rowObj = {},
                                    aooAppendRecord =
                                        make_aooAppendRecord(rowObj)
                                ;
                                headers[src][options.headers].forEach(
                                    aooAppendRecord
                                );
                                aoo.push(rowObj);
                            }
                        }
                    });
                    csvFiles[src].forEach(function(csv){
                        csvParser.write(sources[src].readFileSync(csv));
                    });
                    csvParser.end();

                    grunt.log.write('Writing to ' + f.dest);
                    if(generate_json_ooa){
                        jsonfile.writeFileSync(f.dest, ooa);
                    }else if(generate_json_aoo){
                        jsonfile.writeFileSync(f.dest, aoo);
                    }
                }
            });
        }
    );
};
