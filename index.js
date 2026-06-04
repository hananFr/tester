const fs = require('fs');
const path = require('path');

class HttpError extends Error {
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

/**
 * '
weapons/ GET מחזיר את כל הפריטים מהקובץ, ללא סינון 9
GET /weapons/{id}
מחזיר את הפריט לפי מזהה; פריט שלא קיים →
שגיאת 404
9
POST /weapons
מוסיף פריט, מזהה נוצר ע"י השרת )+1max),
נשמר לקובץ
9
PUT /weapons/{id}
מעדכן פריט קיים, נשמר לקובץ, לא נוצר פריט
חדש
9
{id{/weapons/ DELETE מוחק פריט לפי מזהה, נשמר לקובץ, הפריט נעלם 9
GET /weapons/by-condition?
condition=
מחזיר רק פריטים עם המצב שהתקבל 9
9 condition ∈ {new, good} וגם type לפי מסנן GET /weapons/combat-ready?type=
GET /weapons/summary/by-type
מחזיר ספירה דינמית לכל type( מחושב
9 מהנתונים, לא קשיח(
DELETE /weapons/by-condition?
condition=
מוחק את כל הפריטים המתאימים, נשמר לקובץ 8
 */

const BASE_URL = 'http://localhost:8000';
const PROJECT_DIR = process.env.STUDENT_PROJECT_DIR ? path.resolve(process.env.STUDENT_PROJECT_DIR) : __dirname;
const SOURCE_WEAPONS_FILE = process.env.WEAPONS_SOURCE_FILE
    ? path.resolve(process.env.WEAPONS_SOURCE_FILE)
    : path.join(__dirname, 'weapons.source.json');
const WEAPONS_FILE = path.join(PROJECT_DIR, 'weapons.json');
const GRADES_FILE = path.join(__dirname, 'grades.json');
const SERVER_LOG_FILE = process.env.SERVER_LOG_FILE ? path.resolve(process.env.SERVER_LOG_FILE) : null;
const REQUIRED_FIELDS = ['type', 'model', 'ammo_type', 'condition'];
const RUN_ID = Date.now();
const SKIPPED_DIRS = new Set(['.git', '.venv', 'venv', 'env', '__pycache__', 'node_modules']);
const endpoints = [
    '/weapons',
    '/weapons/{id}',
    'POST /weapons',
    'PUT /weapons/{id}',
    'DELETE /weapons/{id}',
    '/weapons/by-condition',
    '/weapons/combat-ready',
    '/weapons/summary/by-type',
    'DELETE /weapons/by-condition'
];

const codeRequirements = [
    'fastapi_server_runs',
    'json_file_database',
    'logger_usage',
    'http_exception_usage'
];
const LOG_METHODS = 'debug|info|warning|warn|error|exception|critical';

function readWeaponsFile() {
    return JSON.parse(fs.readFileSync(WEAPONS_FILE, 'utf8'));
}

function resetWeaponsFile() {
    if (!fs.existsSync(SOURCE_WEAPONS_FILE)) {
        throw new Error(`Missing source data file: ${SOURCE_WEAPONS_FILE}`);
    }

    JSON.parse(fs.readFileSync(SOURCE_WEAPONS_FILE, 'utf8'));
    fs.copyFileSync(SOURCE_WEAPONS_FILE, WEAPONS_FILE);
}

function readPythonFiles(dir = PROJECT_DIR) {
    const files = [];

    if (!fs.existsSync(dir)) {
        return files;
    }

    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        if (SKIPPED_DIRS.has(entry.name)) {
            continue;
        }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...readPythonFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.py')) {
            files.push({
                path: fullPath,
                content: fs.readFileSync(fullPath, 'utf8')
            });
        }
    }

    return files;
}

function input(prompt = '') {
    if (prompt) {
        fs.writeSync(1, prompt);
    }

    const buffer = Buffer.alloc(1);
    let result = '';

    while (true) {
        const bytesRead = fs.readSync(0, buffer, 0, 1, null);
        if (bytesRead === 0) break;

        const char = buffer.toString();
        if (char === '\n') break;
        if (char !== '\r') {
            result += char;
        }
    }

    return result;
}

function writeGradesFile(result) {
    fs.writeFileSync(GRADES_FILE, `${JSON.stringify(result, null, 2)}\n`);
}

function sameJson(actual, expected) {
    return JSON.stringify(actual) === JSON.stringify(expected);
}

function maxId(weapons) {
    return weapons.reduce((max, weapon) => Math.max(max, Number(weapon.id)), 0);
}

function countByType(weapons) {
    return weapons.reduce((summary, weapon) => {
        summary[weapon.type] = (summary[weapon.type] || 0) + 1;
        return summary;
    }, {});
}

function containsWeapon(weapons, expectedWeapon) {
    return weapons.some((weapon) => sameJson(weapon, expectedWeapon));
}

function assertStatus(error, status) {
    return error instanceof HttpError && error.status === status;
}

function addFailure(grades, endpoint, test, requestInfo, reason, details = {}) {
    grades.failures.push({
        endpoint,
        test,
        request: requestInfo,
        reason,
        ...details
    });
}

function errorDetails(error) {
    if (error instanceof HttpError) {
        return {
            status: error.status,
            response: error.body
        };
    }

    return {
        error: error.message
    };
}

function snapshotServerLog() {
    if (!SERVER_LOG_FILE || !fs.existsSync(SERVER_LOG_FILE)) {
        return null;
    }

    const stats = fs.statSync(SERVER_LOG_FILE);
    return {
        path: SERVER_LOG_FILE,
        size: stats.size
    };
}

function readNewServerLogText(snapshot) {
    if (!snapshot || !fs.existsSync(snapshot.path)) {
        return '';
    }

    const current = fs.readFileSync(snapshot.path, 'utf8');
    return current.slice(snapshot.size);
}

function getLoggerEvidence(allPythonCode) {
    const importsLogging = /import\s+logging|from\s+logging\s+import/.test(allPythonCode);
    const configuresLogging = /logging\.basicConfig|logging\.getLogger|getLogger\s*\(/.test(allPythonCode);
    const createsLogger = /\b\w*logger\w*\s*=|\blog\s*=|logging\.getLogger|getLogger\s*\(/i.test(allPythonCode);
    const directLoggingCall = new RegExp(`\\blogging\\.(${LOG_METHODS})\\s*\\(`).test(allPythonCode);
    const importedLoggingCall = new RegExp(`from\\s+logging\\s+import[\\s\\S]*\\b(${LOG_METHODS})\\b[\\s\\S]*\\b(${LOG_METHODS})\\s*\\(`).test(allPythonCode);
    const anyLoggerLikeCall = new RegExp(`\\.(${LOG_METHODS})\\s*\\(`).test(allPythonCode);
    const logsEvents = directLoggingCall || importedLoggingCall || (importsLogging && anyLoggerLikeCall);

    return {
        imports_logging: importsLogging,
        configures_logging: configuresLogging,
        creates_logger: createsLogger,
        direct_logging_call: directLoggingCall,
        imported_logging_call: importedLoggingCall,
        logger_like_call: anyLoggerLikeCall,
        logs_events: logsEvents,
        static_passed: importsLogging && logsEvents
    };
}

async function request(method, route, body) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${BASE_URL}${route}`, options);
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
        const message = data?.detail || data?.message || data?.error || res.statusText;
        throw new HttpError(message, res.status, data);
    }

    return data;
}

const http = {
    get: (route) => request('GET', route),
    post: (route, body) => request('POST', route, body),
    put: (route, body) => request('PUT', route, body),
    delete: (route) => request('DELETE', route)
};

function createGradeSheet(studentName) {
    const grades = {
        name: studentName,
        endpoint_points: 0,
        code_quality_points: 0,
        code_requirements: {
            fastapi_server_runs: 0,
            json_file_database: 0,
            logger_usage: 0,
            http_exception_usage: 0
        },
        project_dir: PROJECT_DIR,
        weapons_file: WEAPONS_FILE,
        source_weapons_file: SOURCE_WEAPONS_FILE,
        server_log_file: SERVER_LOG_FILE,
        logger_evidence: null,
        failures: []
    };

    endpoints.forEach((endpoint) => {
        grades[endpoint] = 0;
    });

    return grades;
}

async function gradeCodeRequirements(grades) {
    try {
        await http.get('/openapi.json');
        grades.code_requirements.fastapi_server_runs = 5;
    } catch (error) {
        addFailure(grades, 'code_requirements', 'FastAPI server runs', {method: 'GET', route: '/openapi.json'}, 'FastAPI server did not respond on localhost:8000', errorDetails(error));
        console.log('FastAPI server check failed:', error.message);
    }

    const pythonFiles = readPythonFiles();
    const allPythonCode = pythonFiles.map((file) => file.content).join('\n');

    const usesFastApi = /from\s+fastapi\s+import[\s\S]*FastAPI|import\s+fastapi|fastapi\.FastAPI/.test(allPythonCode);
    if (usesFastApi && grades.code_requirements.fastapi_server_runs === 5) {
        grades.code_requirements.fastapi_server_runs = 5;
    } else if (usesFastApi) {
        grades.code_requirements.fastapi_server_runs = 3;
        addFailure(grades, 'code_requirements', 'FastAPI server runs', {method: 'GET', route: '/openapi.json'}, 'FastAPI code was found, but the server did not respond');
    } else {
        addFailure(grades, 'code_requirements', 'FastAPI server runs', {method: 'static scan', route: PROJECT_DIR}, 'No FastAPI usage was found in Python files');
    }

    const mentionsWeaponsJson = /weapons\.json/.test(allPythonCode);
    const usesJsonModule = /import\s+json|from\s+json\s+import/.test(allPythonCode);
    const readsJson = /json\.load|json\.loads/.test(allPythonCode);
    const writesJson = /json\.dump|json\.dumps/.test(allPythonCode);
    const opensFile = /open\s*\(/.test(allPythonCode);

    if (mentionsWeaponsJson && usesJsonModule && readsJson && writesJson && opensFile) {
        grades.code_requirements.json_file_database = 5;
    } else {
        addFailure(grades, 'code_requirements', 'JSON file database usage', {method: 'static scan', route: PROJECT_DIR}, 'Expected weapons.json with json load/dump and file open usage', {
            mentions_weapons_json: mentionsWeaponsJson,
            imports_json: usesJsonModule,
            reads_json: readsJson,
            writes_json: writesJson,
            opens_file: opensFile
        });
    }

    const loggerEvidence = getLoggerEvidence(allPythonCode);
    grades.logger_evidence = loggerEvidence;

    if (loggerEvidence.static_passed) {
        grades.code_requirements.logger_usage = 5;
    }

    const usesHttpException = /HTTPException/.test(allPythonCode);
    const importsHttpException = /from\s+fastapi\s+import[\s\S]*HTTPException|fastapi\.HTTPException/.test(allPythonCode);
    const returnsErrorObject = /return\s+[\{\(]\s*["']error["']/.test(allPythonCode);

    if (usesHttpException && importsHttpException && !returnsErrorObject) {
        grades.code_requirements.http_exception_usage = 5;
    } else if (usesHttpException && importsHttpException) {
        grades.code_requirements.http_exception_usage = 3;
        addFailure(grades, 'code_requirements', 'HTTPException usage', {method: 'static scan', route: PROJECT_DIR}, 'HTTPException was found, but return {"error": ...} was also found');
    } else {
        addFailure(grades, 'code_requirements', 'HTTPException usage', {method: 'static scan', route: PROJECT_DIR}, 'Expected HTTPException import and usage for HTTP errors', {
            uses_http_exception: usesHttpException,
            imports_http_exception: importsHttpException
        });
    }
}

function gradeRuntimeLogger(grades, logSnapshotBefore) {
    if (grades.code_requirements.logger_usage === 5) {
        return;
    }

    const newLogText = readNewServerLogText(logSnapshotBefore);
    const logGrew = newLogText.trim().length > 0;
    const hasPythonLoggingImport = grades.logger_evidence?.imports_logging;

    if (hasPythonLoggingImport && logGrew) {
        grades.code_requirements.logger_usage = 5;
        grades.logger_evidence.runtime_log_grew = true;
        grades.logger_evidence.runtime_log_sample = newLogText.slice(-500);
        return;
    }

    addFailure(grades, 'code_requirements', 'logger usage', {method: 'static scan + optional server log', route: PROJECT_DIR}, 'Expected Python logging import and at least one log call. To check terminal logs, run server output into SERVER_LOG_FILE.', {
        ...grades.logger_evidence,
        server_log_file: SERVER_LOG_FILE,
        runtime_log_checked: Boolean(logSnapshotBefore),
        runtime_log_grew: logGrew
    });
}

async function gradeGetWeapons(grades) {
    let validPassed = false;

    try {
        const fileWeapons = readWeaponsFile();
        const response = await http.get('/weapons');

        if (sameJson(response, fileWeapons)) {
            grades['/weapons'] += 5;
            validPassed = true;
        } else {
            addFailure(grades, '/weapons', 'valid response returns exact weapons.json data', {method: 'GET', route: '/weapons'}, 'Response did not match weapons.json', {
                expected_count: fileWeapons.length,
                actual_count: Array.isArray(response) ? response.length : null
            });
        }

        if (!validPassed) {
            return;
        }

        const beforeLength = fileWeapons.length;
        const freshWeapon = {
            type: 'rifle',
            model: `FILE-FRESHNESS-CHECK-${RUN_ID}`,
            ammo_type: '5.56mm',
            condition: 'new'
        };

        await http.post('/weapons', freshWeapon);
        const afterFile = readWeaponsFile();
        const afterResponse = await http.get('/weapons');
        const created = afterFile.find((weapon) => weapon.model === freshWeapon.model);

        if (afterFile.length === beforeLength + 1 && created && sameJson(afterResponse, afterFile)) {
            grades['/weapons'] += 4;
        } else {
            addFailure(grades, '/weapons', 'reads fresh data from file after change', {method: 'GET', route: '/weapons'}, 'GET /weapons did not reflect updated weapons.json after POST');
        }
    } catch (error) {
        addFailure(grades, '/weapons', 'valid GET /weapons request', {method: 'GET', route: '/weapons'}, 'Request failed', errorDetails(error));
        console.log('GET /weapons failed:', error.message);
    }
}

async function gradeGetWeaponById(grades) {
    let validPassed = false;

    try {
        const weapons = readWeaponsFile();
        const expected = weapons[0];
        const response = await http.get(`/weapons/${expected.id}`);

        if (sameJson(response, expected)) {
            grades['/weapons/{id}'] += 5;
            validPassed = true;
        } else {
            addFailure(grades, '/weapons/{id}', 'valid id returns matching weapon', {method: 'GET', route: `/weapons/${expected.id}`}, 'Response did not match the weapon from weapons.json');
        }
    } catch (error) {
        const weapons = readWeaponsFile();
        const expected = weapons[0];
        addFailure(grades, '/weapons/{id}', 'valid id returns matching weapon', {method: 'GET', route: `/weapons/${expected?.id}`}, 'Request failed', errorDetails(error));
        console.log('GET /weapons/{id} valid case failed:', error.message);
    }

    if (!validPassed) {
        return;
    }

    try {
        const missingId = maxId(readWeaponsFile()) + 1000;
        await http.get(`/weapons/${missingId}`);
        addFailure(grades, '/weapons/{id}', 'missing id returns 404', {method: 'GET', route: `/weapons/${missingId}`}, 'Expected 404, but request succeeded');
    } catch (error) {
        if (assertStatus(error, 404)) {
            grades['/weapons/{id}'] += 4;
        } else {
            addFailure(grades, '/weapons/{id}', 'missing id returns 404', {method: 'GET', route: `/weapons/${maxId(readWeaponsFile()) + 1000}`}, 'Expected 404', errorDetails(error));
        }
    }
}

async function gradePostWeapon(grades) {
    let validPassed = false;
    const weapon = {
        type: 'machine_gun',
        model: `POST-GRADE-MAG-${RUN_ID}`,
        ammo_type: '7.62mm',
        condition: 'good'
    };

    try {
        const before = readWeaponsFile();
        const expectedId = maxId(before) + 1;
        const response = await http.post('/weapons', weapon);
        const after = readWeaponsFile();
        const created = after.find((item) => item.id === expectedId);
        const responseLooksCreated = response === null || sameJson(response, created) || response.id === expectedId;

        if (
            created &&
            responseLooksCreated &&
            after.length === before.length + 1 &&
            created.id === expectedId &&
            REQUIRED_FIELDS.every((field) => created[field] === weapon[field])
        ) {
            grades['POST /weapons'] += 5;
            validPassed = true;
        } else {
            addFailure(grades, 'POST /weapons', 'valid POST creates weapon with server id', {method: 'POST', route: '/weapons', body: weapon}, 'Created weapon was not found with expected id or expected fields', {
                expected_id: expectedId
            });
        }

        if (validPassed && containsWeapon(readWeaponsFile(), created)) {
            grades['POST /weapons'] += 1;
        } else if (validPassed) {
            addFailure(grades, 'POST /weapons', 'valid POST persists to weapons.json', {method: 'POST', route: '/weapons', body: weapon}, 'Created weapon was not persisted in weapons.json');
        }
    } catch (error) {
        addFailure(grades, 'POST /weapons', 'valid POST creates weapon with server id', {method: 'POST', route: '/weapons', body: weapon}, 'Request failed', errorDetails(error));
        console.log('POST /weapons valid case failed:', error.message);
    }

    if (!validPassed) {
        return;
    }

    const badCases = [
        {
            body: {type: 'rifle', model: 'BAD-CONDITION-TYPE', ammo_type: '5.56mm', condition: 123},
            statuses: [400, 422]
        },
        {
            body: {type: 'rifle', ammo_type: '5.56mm', condition: 'new'},
            statuses: [400, 422]
        },
        {
            body: {id: 99999, type: 'rifle', model: 'CLIENT-ID', ammo_type: '5.56mm', condition: 'new'},
            statuses: [400, 422]
        }
    ];

    for (const badCase of badCases) {
        try {
            await http.post('/weapons', badCase.body);
            addFailure(grades, 'POST /weapons', 'invalid POST body returns error status', {method: 'POST', route: '/weapons', body: badCase.body}, `Expected one of statuses ${badCase.statuses.join(', ')}, but request succeeded`);
        } catch (error) {
            if (error instanceof HttpError && badCase.statuses.includes(error.status)) {
                grades['POST /weapons'] += 1;
            } else {
                addFailure(grades, 'POST /weapons', 'invalid POST body returns error status', {method: 'POST', route: '/weapons', body: badCase.body}, `Expected one of statuses ${badCase.statuses.join(', ')}`, errorDetails(error));
            }
        }
    }
}

async function gradePutWeapon(grades) {
    let validPassed = false;

    try {
        const before = readWeaponsFile();
        const target = before.find((weapon) => weapon.condition !== 'critical') || before[0];
        const update = {
            type: target.type,
            model: `PUT-GRADE-UPDATED-${RUN_ID}`,
            ammo_type: target.ammo_type,
            condition: 'critical'
        };

        const response = await http.put(`/weapons/${target.id}`, update);
        const after = readWeaponsFile();
        const updated = after.find((weapon) => weapon.id === target.id);
        const responseLooksUpdated = response === null || sameJson(response, updated) || response.id === target.id;

        if (
            updated &&
            responseLooksUpdated &&
            after.length === before.length &&
            updated.model === update.model &&
            updated.condition === update.condition
        ) {
            grades['PUT /weapons/{id}'] += 5;
            validPassed = true;
        } else {
            addFailure(grades, 'PUT /weapons/{id}', 'valid PUT updates existing weapon', {method: 'PUT', route: `/weapons/${target.id}`, body: update}, 'Weapon was not updated as expected or a new item was created');
        }

        const otherItemsUnchanged = before
            .filter((weapon) => weapon.id !== target.id)
            .every((weapon) => sameJson(weapon, after.find((item) => item.id === weapon.id)));

        if (validPassed && otherItemsUnchanged && sameJson(readWeaponsFile().find((weapon) => weapon.id === target.id), updated)) {
            grades['PUT /weapons/{id}'] += 2;
        } else if (validPassed) {
            addFailure(grades, 'PUT /weapons/{id}', 'valid PUT only changes target and persists to file', {method: 'PUT', route: `/weapons/${target.id}`, body: update}, 'Other items changed or update was not persisted to weapons.json');
        }
    } catch (error) {
        const target = readWeaponsFile().find((weapon) => weapon.condition !== 'critical') || readWeaponsFile()[0];
        addFailure(grades, 'PUT /weapons/{id}', 'valid PUT updates existing weapon', {method: 'PUT', route: `/weapons/${target?.id}`}, 'Request failed', errorDetails(error));
        console.log('PUT /weapons/{id} valid case failed:', error.message);
    }

    if (!validPassed) {
        return;
    }

    try {
        const missingId = maxId(readWeaponsFile()) + 1000;
        const body = {
            type: 'rifle',
            model: 'M4',
            ammo_type: '5.56mm',
            condition: 'new'
        };
        await http.put(`/weapons/${missingId}`, body);
        addFailure(grades, 'PUT /weapons/{id}', 'missing id returns 404', {method: 'PUT', route: `/weapons/${missingId}`, body}, 'Expected 404, but request succeeded');
    } catch (error) {
        if (assertStatus(error, 404)) {
            grades['PUT /weapons/{id}'] += 2;
        } else {
            addFailure(grades, 'PUT /weapons/{id}', 'missing id returns 404', {method: 'PUT', route: `/weapons/${maxId(readWeaponsFile()) + 1000}`}, 'Expected 404', errorDetails(error));
        }
    }
}

async function gradeDeleteWeapon(grades) {
    let deletedId;
    let validPassed = false;

    try {
        const before = readWeaponsFile();
        const target = before.find((weapon) => weapon && weapon.id !== undefined);

        if (!target || !before.some((weapon) => weapon.id === target.id)) {
            throw new Error('No existing weapon found in weapons.json for delete test');
        }

        deletedId = target.id;
        await http.delete(`/weapons/${target.id}`);
        const after = readWeaponsFile();

        if (after.length === before.length - 1 && !after.some((weapon) => weapon.id === target.id)) {
            grades['DELETE /weapons/{id}'] += 5;
            validPassed = true;
        } else {
            addFailure(grades, 'DELETE /weapons/{id}', 'valid DELETE removes existing weapon', {method: 'DELETE', route: `/weapons/${target.id}`}, 'Target weapon was not removed from weapons.json');
        }

        const onlyTargetDeleted = before
            .filter((weapon) => weapon.id !== target.id)
            .every((weapon) => sameJson(weapon, after.find((item) => item.id === weapon.id)));

        if (validPassed && onlyTargetDeleted && !readWeaponsFile().some((weapon) => weapon.id === target.id)) {
            grades['DELETE /weapons/{id}'] += 2;
        } else if (validPassed) {
            addFailure(grades, 'DELETE /weapons/{id}', 'valid DELETE removes only target and persists to file', {method: 'DELETE', route: `/weapons/${target.id}`}, 'Other items changed or delete was not persisted to weapons.json');
        }
    } catch (error) {
        addFailure(grades, 'DELETE /weapons/{id}', 'valid DELETE removes existing weapon', {method: 'DELETE', route: deletedId ? `/weapons/${deletedId}` : '/weapons/{existing_id}'}, 'Request failed', errorDetails(error));
        console.log('DELETE /weapons/{id} valid case failed:', error.message);
    }

    if (!validPassed) {
        return;
    }

    try {
        await http.delete(`/weapons/${deletedId || maxId(readWeaponsFile()) + 1000}`);
        addFailure(grades, 'DELETE /weapons/{id}', 'missing id returns 404', {method: 'DELETE', route: `/weapons/${deletedId || maxId(readWeaponsFile()) + 1000}`}, 'Expected 404, but request succeeded');
    } catch (error) {
        if (assertStatus(error, 404)) {
            grades['DELETE /weapons/{id}'] += 2;
        } else {
            addFailure(grades, 'DELETE /weapons/{id}', 'missing id returns 404', {method: 'DELETE', route: `/weapons/${deletedId || maxId(readWeaponsFile()) + 1000}`}, 'Expected 404', errorDetails(error));
        }
    }
}

async function gradeByCondition(grades) {
    let validPassed = false;

    try {
        const weapons = readWeaponsFile();
        const condition = 'damaged';
        const expected = weapons.filter((weapon) => weapon.condition === condition);
        const response = await http.get(`/weapons/by-condition?condition=${condition}`);

        if (sameJson(response, expected)) {
            grades['/weapons/by-condition'] += 5;
            validPassed = true;
        } else {
            addFailure(grades, '/weapons/by-condition', 'valid condition returns matching weapons', {method: 'GET', route: `/weapons/by-condition?condition=${condition}`}, 'Response did not match weapons with requested condition', {
                expected_count: expected.length,
                actual_count: Array.isArray(response) ? response.length : null
            });
        }

        if (validPassed && response.every((weapon) => weapon.condition === condition)) {
            grades['/weapons/by-condition'] += 2;
        } else if (validPassed) {
            addFailure(grades, '/weapons/by-condition', 'all returned weapons have requested condition', {method: 'GET', route: `/weapons/by-condition?condition=${condition}`}, 'Some returned weapons had a different condition');
        }
    } catch (error) {
        addFailure(grades, '/weapons/by-condition', 'valid condition returns matching weapons', {method: 'GET', route: '/weapons/by-condition?condition=damaged'}, 'Request failed', errorDetails(error));
        console.log('GET /weapons/by-condition valid case failed:', error.message);
    }

    if (!validPassed) {
        return;
    }

    try {
        const response = await http.get('/weapons/by-condition?condition=not-real-condition');
        if (Array.isArray(response) && response.length === 0) {
            grades['/weapons/by-condition'] += 2;
        } else {
            addFailure(grades, '/weapons/by-condition', 'unknown condition returns empty array or valid error', {method: 'GET', route: '/weapons/by-condition?condition=not-real-condition'}, 'Expected empty array for unknown condition');
        }
    } catch (error) {
        if ([400, 404, 422].includes(error.status)) {
            grades['/weapons/by-condition'] += 2;
        } else {
            addFailure(grades, '/weapons/by-condition', 'unknown condition returns empty array or valid error', {method: 'GET', route: '/weapons/by-condition?condition=not-real-condition'}, 'Expected empty array or status 400/404/422', errorDetails(error));
        }
    }
}

async function gradeCombatReady(grades) {
    let validPassed = false;

    try {
        const weapons = readWeaponsFile();
        const type = 'machine_gun';
        const expected = weapons.filter((weapon) => weapon.type === type && ['new', 'good'].includes(weapon.condition));
        const response = await http.get(`/weapons/combat-ready?type=${type}`);

        if (sameJson(response, expected)) {
            grades['/weapons/combat-ready'] += 5;
            validPassed = true;
        } else {
            addFailure(grades, '/weapons/combat-ready', 'valid type returns only combat-ready weapons', {method: 'GET', route: `/weapons/combat-ready?type=${type}`}, 'Response did not match weapons with requested type and condition new/good', {
                expected_count: expected.length,
                actual_count: Array.isArray(response) ? response.length : null
            });
        }

        if (validPassed && response.every((weapon) => weapon.type === type)) {
            grades['/weapons/combat-ready'] += 2;
        } else if (validPassed) {
            addFailure(grades, '/weapons/combat-ready', 'all returned weapons have requested type', {method: 'GET', route: `/weapons/combat-ready?type=${type}`}, 'Some returned weapons had a different type');
        }

        if (validPassed && response.every((weapon) => ['new', 'good'].includes(weapon.condition))) {
            grades['/weapons/combat-ready'] += 2;
        } else if (validPassed) {
            addFailure(grades, '/weapons/combat-ready', 'all returned weapons are combat ready', {method: 'GET', route: `/weapons/combat-ready?type=${type}`}, 'Some returned weapons were not new/good');
        }
    } catch (error) {
        addFailure(grades, '/weapons/combat-ready', 'valid type returns only combat-ready weapons', {method: 'GET', route: '/weapons/combat-ready?type=machine_gun'}, 'Request failed', errorDetails(error));
        console.log('GET /weapons/combat-ready valid case failed:', error.message);
    }
}

async function gradeSummaryByType(grades) {
    let validPassed = false;

    try {
        const expected = countByType(readWeaponsFile());
        const response = await http.get('/weapons/summary/by-type');

        if (sameJson(response, expected)) {
            grades['/weapons/summary/by-type'] += 5;
            validPassed = true;
        } else {
            addFailure(grades, '/weapons/summary/by-type', 'valid summary by type', {method: 'GET', route: '/weapons/summary/by-type'}, 'Response did not match dynamic count by type');
        }

        if (!validPassed) {
            return;
        }

        const dynamicType = `summary_dynamic_type_${RUN_ID}`;
        const newTypeWeapon = {
            type: dynamicType,
            model: 'SUMMARY-DYNAMIC-CHECK',
            ammo_type: 'test',
            condition: 'new'
        };

        await http.post('/weapons', newTypeWeapon);
        const dynamicExpected = countByType(readWeaponsFile());
        const dynamicResponse = await http.get('/weapons/summary/by-type');

        if (sameJson(dynamicResponse, dynamicExpected) && dynamicResponse[dynamicType] === 1) {
            grades['/weapons/summary/by-type'] += 4;
        } else {
            addFailure(grades, '/weapons/summary/by-type', 'summary recalculates after data changes', {method: 'GET', route: '/weapons/summary/by-type'}, 'Summary did not update after adding a new type', {
                added_type: dynamicType
            });
        }
    } catch (error) {
        addFailure(grades, '/weapons/summary/by-type', 'valid summary by type', {method: 'GET', route: '/weapons/summary/by-type'}, 'Request failed', errorDetails(error));
        console.log('GET /weapons/summary/by-type failed:', error.message);
    }
}

async function gradeDeleteByCondition(grades) {
    const condition = 'critical';
    let validPassed = false;

    try {
        const before = readWeaponsFile();
        const expectedRemaining = before.filter((weapon) => weapon.condition !== condition);
        const expectedDeletedCount = before.length - expectedRemaining.length;

        await http.delete(`/weapons/by-condition?condition=${condition}`);
        const after = readWeaponsFile();

        if (expectedDeletedCount > 0 && sameJson(after, expectedRemaining)) {
            grades['DELETE /weapons/by-condition'] += 5;
            validPassed = true;
        } else {
            addFailure(grades, 'DELETE /weapons/by-condition', 'valid DELETE by condition removes matching weapons', {method: 'DELETE', route: `/weapons/by-condition?condition=${condition}`}, 'File contents did not match expected remaining weapons after delete', {
                expected_deleted_count: expectedDeletedCount
            });
        }

        if (validPassed && !after.some((weapon) => weapon.condition === condition) && sameJson(readWeaponsFile(), expectedRemaining)) {
            grades['DELETE /weapons/by-condition'] += 3;
        } else if (validPassed) {
            addFailure(grades, 'DELETE /weapons/by-condition', 'valid DELETE by condition persists and removes all matching weapons', {method: 'DELETE', route: `/weapons/by-condition?condition=${condition}`}, 'Some matching weapons remained or delete was not persisted');
        }
    } catch (error) {
        addFailure(grades, 'DELETE /weapons/by-condition', 'valid DELETE by condition removes matching weapons', {method: 'DELETE', route: `/weapons/by-condition?condition=${condition}`}, 'Request failed', errorDetails(error));
        console.log('DELETE /weapons/by-condition valid case failed:', error.message);
    }
}

async function testFastApi() {
    const studentName = input('Student Name \n');
    resetWeaponsFile();
    const logSnapshotBefore = snapshotServerLog();
    const grades = createGradeSheet(studentName);

    await gradeCodeRequirements(grades);
    await gradeGetWeapons(grades);
    await gradeGetWeaponById(grades);
    await gradePostWeapon(grades);
    await gradePutWeapon(grades);
    await gradeDeleteWeapon(grades);
    await gradeByCondition(grades);
    await gradeCombatReady(grades);
    await gradeSummaryByType(grades);
    await gradeDeleteByCondition(grades);
    gradeRuntimeLogger(grades, logSnapshotBefore);

    grades.endpoint_points = endpoints.reduce((sum, endpoint) => sum + grades[endpoint], 0);
    grades.code_quality_points = codeRequirements.reduce((sum, requirement) => {
        return sum + grades.code_requirements[requirement];
    }, 0);
    grades.total = grades.endpoint_points + grades.code_quality_points;
    grades.max_score = 100;
    writeGradesFile(grades);
    console.log(grades);
}

testFastApi().catch((error) => {
    console.error('Test runner failed:', error.message);
});
