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
                i = 0|0,
                j = 0|0,
                chunk = 1024|0,
                done = this.async(),
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
                    generate_sql_sqlite = false,
                    generate_sql_sql = false,
                    last
                ;
                if(/\.ooa\.json$/.test(f.dest) || /^ooa\.json$/.test(f.dest)){
                    generate_json_ooa = true;
                }else if(
                    /\.aoo\.json$/.test(f.dest) ||
                    /^aoo\.json$/.test(f.dest)
                ){
                    generate_json_aoo = true;
                }else if(/\.sqlite$/.test(f.dest)){
                    generate_sql_sqlite = true;
                }else if(/\.sql$/.test(f.dest)){
                    generate_sql_sql = true;
                }

                if(
                    generate_sql_sql === false &&
                    generate_sql_sqlite === false &&
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

                if(
                    generate_sql_sql ||
                    generate_sql_sqlite ||
                    generate_json_ooa ||
                    generate_json_aoo
                ){
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
                    if(
                        generate_json_ooa ||
                        generate_sql_sql ||
                        generate_sql_sqlite
                    ){
                        headers[src][options.headers].forEach(function(header){
                            if(header !== false){
                                ooa[header] = [];
                            }
                        });
                    }
                    if(
                        generate_sql_sql ||
                        generate_sql_sqlite ||
                        generate_json_ooa
                    ){
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
                        if(
                            generate_sql_sql ||
                            generate_sql_sqlite ||
                            generate_json_ooa
                        ){
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
                        done();
                    }else if(generate_json_aoo){
                        grunt.log.writeln(aoo.length + ' entries to write');
                        if(options.whitespace){
                            fs.writeFileSync(f.dest, '[' + "\n");
                        }else{
                            fs.writeFileSync(f.dest, '[');
                        }
                        j = aoo.length - (aoo.length % chunk);
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
                        done();
                    }else if(
                        generate_sql_sqlite ||
                        generate_sql_sql
                    ){
                        if(generate_sql_sqlite){
                        grunt.log.writeln("Setting up SQLITE for " + f.dest);
                        fs.writeFileSync(f.dest, '');
                        }
                        // assumes minimal mode, i.e. won't include all cols
                        var
                            sql = module.require('sql'),
                            SQLiteDialect = module.require(
                                'sql/lib/dialect/sqlite'
                            ),
                            MySQLDialect = module.require(
                                'sql/lib/dialect/mysql'
                            ),
                            sqlite = new SQLiteDialect(),
                            mysql = new MySQLDialect(),
                            db,
                            makeDb = function(){
                                db = (
                                    new (
                                        module.require('sqlite3').verbose()
                                    ).Database(f.dest)
                                );
                            },
                            schema = {
                                'name': 'postcodes',
                                columns: [
                                    {
                                        name: "postcode",
                                        dataType: "varchar",
                                        primaryKey: true
                                    },
                                    {
                                        name: "pq",
                                        dataType: "float",
                                    },
                                    {
                                        name: "eastings",
                                        dataType: "int"
                                    },
                                    {
                                        name: "northings",
                                        dataType: "int"
                                    }
                                ]
                            },
                            insertSpec = {
                                postcode: function(idx){
                                    return (
                                        ooa[
                                            headers[src][
                                                options.headers
                                            ][0]
                                        ][
                                            idx
                                        ].toLowerCase().replace(/\s+/g, '')
                                    );
                                },
                                pq: function(idx){
                                    return (
                                        ooa[headers[src][
                                            options.headers][1]
                                        ][idx]
                                    );
                                },
                                eastings: function(idx){
                                    return (
                                        ooa[headers[src][
                                            options.headers][2]
                                        ][idx]
                                    );
                                },
                                northings: function(idx){
                                    return (
                                        ooa[headers[src][
                                            options.headers][3]
                                        ][idx]
                                    );
                                }
                            },
                            destTable,
                            insertSql,
                            insertRow = {},
                            total = (
                                ooa[
                                    headers[src][options.headers][0]
                                ].length
                            ),
                            queued = 0|0,
                            stmtInsertLastLength = 0|0,
                            stmtInsertChunk = [],
                            stmtParams = [],
                            make_sqliteFlattener = function(j){
                                return function(col){
                                    return insertSpec[col][j];
                                };
                            },
                            make_mysqlLoop = function(j){
                                return function(col){
                                    insertRow[col] =
                                        insertSpec[col](j)
                                    ;
                                };
                            },
                            stmt
                        ;
                        chunk = 128;
                        if(options.latlng){
                            schema = {
                                'name': 'postcodes',
                                'columns': [
                                    {
                                        name: "postcode",
                                        dataType: "varchar",
                                        primaryKey: true
                                    },
                                    {
                                        name: "pq",
                                        dataType: "float",
                                    },
                                    {
                                        name: "latitude",
                                        dataType: "float"
                                    },
                                    {
                                        name: "longitude",
                                        dataType: "float"
                                    }
                                ]
                            };
                            insertSpec = {
                                postcode: insertSpec.postcode,
                                pq: insertSpec.pq
                            };
                            if(options.minimal){
                                insertSpec.latitude = function(idx){
                                    return (
                                        ooa['LAT'][idx]
                                    );
                                };
                                insertSpec.longitude = function(idx){
                                    return (
                                        ooa['LNG'][idx]
                                    );
                                };
                            }else{
                                insertSpec.latitude = function(idx){
                                    return (
                                        ooa['Latitude'][idx]
                                    );
                                };
                                insertSpec.longitude = function(idx){
                                    return (
                                        ooa['Longitude'][idx]
                                    );
                                };
                            }
                        }
                        if(generate_sql_sql){
                            schema.columns[0].dataType = 'varchar(16)';
                        }
                        destTable = sql.define(schema);
                        Object.keys(insertSpec).forEach(
                            function(col){
                                insertRow[col] =
                                    insertSpec[col](0)
                                ;
                            }
                        );

                        if(generate_sql_sql){
                            grunt.log.writeln(
                                'Writing SQL statements to ' + f.dest
                            );
                            fs.writeFileSync(
                                f.dest,
                                (
                                    mysql.getQuery(destTable.create()).text +
                                    ';' +
                                    "\n"
                                )
                            );
                            for(i=0;i<total;i+=chunk){
                                if(i % (chunk * 128) === 0){
                                    grunt.log.writeln(
                                        (
                                            Math.floor(
                                                ((i + 1) / total) * 10000
                                            ) / 100
                                        ) + '%'
                                    );
                                }
                                stmtInsertChunk = [];
                                for(j=i;j<Math.min(total, i + chunk);++j){
                                    insertRow = {};
                                    Object.keys(insertSpec).forEach(
                                        make_mysqlLoop(j)
                                    );
                                    stmtParams.concat(
                                        Object.keys(insertSpec).map(
                                            make_sqliteFlattener(j)
                                        )
                                    );
                                    stmtInsertChunk.push(insertRow);
                                }
                                fs.appendFileSync(
                                    f.dest,
                                    (
                                        (
                                            mysql.getString(destTable.insert(
                                                stmtInsertChunk
                                            ))
                                        ) +
                                        ';' +
                                        "\n"
                                    )
                                );
                            }
                            done();
                            return;
                        }else if(generate_sql_sqlite){
                        makeDb();

                        db.serialize(function(){
                            grunt.log.writeln('Creating table on ' + f.dest);
                            db.run(destTable.create().toQuery().text);
                        });

                        db.close(function(){
                            makeDb();
                            stmt = db.prepare(sqlite.getQuery(
                                destTable.insert(insertRow)
                            ).text);
                            db.parallelize(function(){
                                grunt.log.writeln(
                                    'Inserting rows on ' +
                                    f.dest
                                );
                                for(i=0;i<total;i+=chunk){
                                    if(i % (chunk * 128) === 0){
                                        grunt.log.writeln(
                                            (
                                                Math.floor(
                                                    ((i + 1) / total) * 10000
                                                ) / 100
                                            ) + '%'
                                        );
                                    }
                                    stmtInsertChunk = [];
                                    for(j=i;j<Math.min(total, i + chunk);++j){
                                        stmtParams.concat(
                                            Object.keys(insertSpec).map(
                                                make_sqliteFlattener(j)
                                            )
                                        );
                                        stmtInsertChunk.push(insertRow);
                                    }
                                    stmt = db.prepare(sqlite.getQuery(
                                        destTable.insert(stmtInsertChunk)
                                    ).text);
                                    stmtInsertLastLength =
                                        stmtInsertChunk.length
                                    ;
                                    stmt.run.apply(stmt, stmtParams);
                                }
                            });

                            grunt.log.writeln('Awaiting closure of ' + f.dest);

                            db.close(function(){
                                makeDb();
                                db.get(
                                    'SELECT COUNT(*) FROM postcodes',
                                    function(err, row){
                                        grunt.log.writeln(
                                            row['COUNT(*)'] +
                                            ' rows written to ' +
                                            f.dest
                                        );
                                    }
                                );
                                db.close(function(){
                                    done();
                                });
                            });
                        });
                        }
                    }
                }
            });
        }
    );
};
