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
                    minimal: false,
                    headers: 1,
                    latlng: false,
                    whitespace: true
                }),
                sources = {},
                headers = {},
                csvFiles = {},
                zipfile = module.require('zipfile'),
                csvParse = module.require('csv-parse'),
                OSGridRef = module.require('geodesy/osgridref'),
                fs = module.require('fs'),
                osg = new OSGridRef(0, 0),
                csvParser
            ;

            if(typeof(options.headers) !== 'number'){
                grunt.log.warn("options.headers must be a number.");
                return false;
            }else if(options.headers < 0){
                grunt.log.warn("options.headers must be greater than zero.");
            }else if(typeof(options.latlng) !== 'boolean'){
                grunt.log.warn('options.latlng must be a boolean.');
                return false;
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
                    generate_json_aoo = false,
                    last
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
                    grunt.log.writeln('Checking File Contents of ' + src);
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
                    grunt.log.writeln('Building list of CSV files for ' + src);
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
                    if(options.minimal){
                        headers[src][0].forEach(function(e, i){
                            if(
                                (
                                    options.latlng ? [
                                        0,
                                        1
                                    ] : [
                                        0,
                                        1,
                                        2,
                                        3
                                    ]
                                ).indexOf(i) === -1
                            ){
                                headers[src][0][i] = false;
                                headers[src][1][i] = false;
                            }
                        });
                    }
                }

                if(generate_json_ooa || generate_json_aoo){
                    var
                        ooa = {},
                        aoo = [],
                        do_ooaAppendRecord = function(record){
                            var
                                ooaAppendRecord = function(e, i){
                                    if(i === 1 || i === 2 || i === 3){
                                        e = parseFloat(e);
                                    }
                                    if(
                                        headers[src][
                                            options.headers
                                        ][i] !== false
                                    ){
                                        ooa[
                                            headers[src][options.headers][i]
                                        ].push(e);
                                    }
                                }
                            ;
                            record.forEach(ooaAppendRecord);
                        },
                        do_aooAppendRecord = function(
                            rowObj,
                            record,
                            headers
                        ){
                            var
                                loop = function(e, i){
                                    if(e === false){
                                        return;
                                    }
                                    if(i === 1 || i === 2 || i === 3){
                                        rowObj[e] = parseFloat(record[i]);
                                    }else{
                                        rowObj[e] = record[i];
                                    }
                                }
                            ;
                            headers.forEach(loop);
                        }
                    ;
                    if(generate_json_ooa){
                        headers[src][options.headers].forEach(function(header){
                            if(header !== false){
                                ooa[header] = [];
                            }
                        });
                        if(options.latlng){
                            var
                                orig_do_ooaAppendRecord = do_ooaAppendRecord
                            ;
                            if(options.headers === 1){
                                ooa['Latitude'] = [];
                                ooa['Longitude'] = [];
                                do_ooaAppendRecord = function(record){
                                    orig_do_ooaAppendRecord(record);
                                    osg.easting = parseFloat(record[2]);
                                    osg.northing = parseFloat(record[3]);
                                    var
                                        latlng = OSGridRef.osGridToLatLon(osg)
                                    ;
                                    ooa['Latitude'].push(latlng.lat);
                                    ooa['Longitude'].push(latlng.lon);
                                };
                            }else{
                                ooa['LAT'] = [];
                                ooa['LNG'] = [];
                                do_ooaAppendRecord = function(record){
                                    orig_do_ooaAppendRecord(record);
                                    osg.easting = parseFloat(record[2]);
                                    osg.northing = parseFloat(record[3]);
                                    var
                                        latlng = OSGridRef.osGridToLatLon(osg)
                                    ;
                                    ooa['LAT'].push(latlng.lat);
                                    ooa['LNG'].push(latlng.lon);
                                };
                            }
                        }
                    }else if(generate_json_aoo){
                        if(options.latlng){
                            var
                                orig_do_aooAppendRecord = do_aooAppendRecord
                            ;
                            if(options.headers === 1){
                                do_aooAppendRecord = function(
                                    rowObj,
                                    record,
                                    headers
                                ){
                                    orig_do_aooAppendRecord(
                                        rowObj,
                                        record,
                                        headers
                                    );
                                    osg.easting = parseFloat(record[2]);
                                    osg.northing = parseFloat(record[3]);
                                    var
                                        latlng = OSGridRef.osGridToLatLon(osg)
                                    ;
                                    rowObj['Latitude'] = latlng.lat;
                                    rowObj['Longitude'] = latlng.lon;
                                };
                            }else{
                                do_aooAppendRecord = function(
                                    rowObj,
                                    record,
                                    headers
                                ){
                                    orig_do_aooAppendRecord(
                                        rowObj,
                                        record,
                                        headers
                                    );
                                    osg.easting = parseFloat(record[2]);
                                    osg.northing = parseFloat(record[3]);
                                    var
                                        latlng = OSGridRef.osGridToLatLon(osg)
                                    ;
                                    rowObj['LAT'] = latlng.lat;
                                    rowObj['LNG'] = latlng.lon;
                                };
                            }
                        }
                    }
                    grunt.log.writeln('Building JSON Data for ' + f.dest);
                    csvParser = csvParse({delimeter: ','});
                    csvParser.on('readable', function(){
                        var
                            record = []
                        ;
                        if(generate_json_ooa){
                            while(record = csvParser.read()){
                                do_ooaAppendRecord(record);
                            }
                        }else if(generate_json_aoo){
                            while(record = csvParser.read()){
                                var
                                    rowObj = {}
                                ;
                                do_aooAppendRecord(
                                    rowObj,
                                    record,
                                    headers[src][options.headers]
                                );
                                aoo.push(rowObj);
                            }
                        }
                    });
                    csvFiles[src].forEach(function(csv){
                        csvParser.write(sources[src].readFileSync(csv));
                    });
                    csvParser.end();

                    grunt.log.writeln('Writing to ' + f.dest);
                    if(generate_json_ooa){
                        grunt.log.writeln(
                            ooa[headers[src][options.headers][0]].length +
                            ' entries to write'
                        );
                        var
                            ooaKeys = Object.keys(ooa),
                            write_ooaKey = function(ooaKey, i){
                                fs.appendFileSync(
                                    f.dest,
                                    JSON.stringify(ooaKey) + ' : [' + "\n"
                                );
                                fs.appendFileSync(
                                    f.dest,
                                    ' ' + ooa[ooaKey].map(function(e){
                                        return ' ' + JSON.stringify(e);
                                    }).join(',' + "\n") + "\n"
                                );
                                if(i >= 0){
                                    fs.appendFileSync(
                                        f.dest,
                                        (']' + ',' + "\n")
                                    );
                                }else{
                                    fs.appendFileSync(f.dest, ']' + "\n");
                                }
                            }
                        ;
                        if(!options.whitespace){
                            write_ooaKey = function(ooaKey, i){
                                fs.appendFileSync(
                                    f.dest,
                                    JSON.stringify(ooaKey) + ':['
                                );
                                fs.appendFileSync(
                                    f.dest,
                                    ooa[ooaKey].map(JSON.stringify).join(',')
                                );
                                if(i >= 0){
                                    fs.appendFileSync(f.dest, ']' + ',');
                                }else{
                                    fs.appendFileSync(f.dest, ']');
                                }
                            };
                        }
                        last = ooaKeys.pop();
                        fs.writeFileSync(
                            f.dest,
                            (
                                '{' +
                                (options.whitespace ? "\n" : '')
                            )
                        );
                        ooaKeys.forEach(write_ooaKey);
                        ooaKeys.push(last);
                        write_ooaKey(last, -1);
                        fs.appendFileSync(f.dest, '}');
                    }else if(generate_json_aoo){
                        grunt.log.writeln(aoo.length + ' entries to write');
                        if(options.whitespace){
                            fs.writeFileSync(f.dest, '[' + "\n");
                        }else{
                            fs.writeFileSync(f.dest, '[');
                        }
                        var
                            i = 0|0,
                            chunk = 1024|0,
                            j = aoo.length - (aoo.length % chunk)
                        ;
                        for(i=0;i<aoo.length;i+=chunk){
                            fs.appendFileSync(
                                f.dest,
                                (
                                    aoo.slice(i, i + chunk).map(
                                        JSON.stringify
                                    ).join(
                                        ',' +
                                        (options.whitespace ? "\n" : '')
                                    )
                                )
                            );
                            if(i < j){
                                fs.appendFileSync(f.dest, (
                                    ',' +
                                    (options.whitespace ? "\n" : '')
                                ));
                            }
                        }
                        fs.appendFileSync(f.dest, ']');
                    }
                }
            });
        }
    );
};
