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
מחזיר את הפריט לפי מזהה קיים
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
const GRADES_DIR = path.join(__dirname, 'grades');
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
    fs.mkdirSync(GRADES_DIR, {recursive: true});

    const studentSlug = String(result.name || 'student')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u0590-\u05ff]+/gi, '-')
        .replace(/^-+|-+$/g, '') || 'student';
    const studentGradesFile = path.join(GRADES_DIR, `${studentSlug}.json`);
    const studentReportFile = path.join(GRADES_DIR, `${studentSlug}.md`);
    const summaryFile = path.join(GRADES_DIR, 'summary.md');

    for (const file of fs.readdirSync(GRADES_DIR)) {
        const isSameStudentResult =
            file === `${studentSlug}.json` ||
            file === `${studentSlug}.md` ||
            file.startsWith(`${studentSlug}-`);

        if (isSameStudentResult && (file.endsWith('.json') || file.endsWith('.md'))) {
            fs.rmSync(path.join(GRADES_DIR, file), {force: true});
        }
    }

    result.checked_at = new Date(RUN_ID).toISOString();
    result.grades_file = studentGradesFile;
    result.report_file = studentReportFile;
    result.latest_grades_file = GRADES_FILE;
    result.summary_file = summaryFile;

    fs.writeFileSync(studentGradesFile, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(studentReportFile, buildStudentReport(result));
    fs.writeFileSync(GRADES_FILE, `${JSON.stringify(result, null, 2)}\n`);
    writeSummaryFile(summaryFile);
}

function escapeMarkdown(value) {
    return String(value ?? '')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, '<br>');
}

function markdownTable(headers, rows) {
    const headerLine = `| ${headers.map(escapeMarkdown).join(' | ')} |`;
    const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
    const rowLines = rows.map((row) => `| ${row.map(escapeMarkdown).join(' | ')} |`);
    return `${[headerLine, separatorLine, ...rowLines].join('\n')}\n`;
}

function buildStudentReport(result) {
    const endpointRows = endpoints.map((endpoint) => [
        endpoint,
        result[endpoint],
        endpoint === 'DELETE /weapons/by-condition' ? 8 : 9
    ]);

    const codeRows = [
        ['FastAPI server runs', result.code_requirements.fastapi_server_runs, 5],
        ['JSON file database', result.code_requirements.json_file_database, 5],
        ['Logger usage', result.code_requirements.logger_usage, 5],
        ['HTTPException usage', result.code_requirements.http_exception_usage, 5]
    ];

    const validationRows = (result.validation_results || []).map((validation) => [
        validation.test,
        validation.endpoint,
        validation.deducted ? -1 : 0
    ]);

    const failures = result.failures?.length
        ? result.failures.map((failure, index) => {
            return [
                `### ${index + 1}. ${failure.endpoint} - ${failure.test}`,
                '',
                `- בקשה/בדיקה: \`${failure.request?.method || ''} ${failure.request?.route || ''}\``,
                `- סיבה: ${failure.reason}`,
                '',
                '```json',
                JSON.stringify(failure, null, 2),
                '```'
            ].join('\n');
        }).join('\n\n')
        : 'אין כשלים מפורטים.';

    return [
        `# דוח בדיקה - ${result.name}`,
        '',
        '## סיכום בסיסי',
        '',
        markdownTable(
            ['שם', 'ציון סופי', 'אנדפוינטים', 'איכות קוד', 'מקסימום'],
            [[result.name, result.total, result.endpoint_points, result.code_quality_points, result.max_score]]
        ),
        '## ניקוד לפי אנדפוינט',
        '',
        markdownTable(['סעיף', 'ניקוד', 'מקסימום'], endpointRows),
        '## ניקוד איכות קוד',
        '',
        markdownTable(['סעיף', 'ניקוד', 'מקסימום'], codeRows),
        '## בדיקות ולידציה',
        '',
        validationRows.length
            ? markdownTable(['מקרה', 'אנדפוינט', 'הורדה'], validationRows)
            : 'לא הורצו בדיקות ולידציה.',
        '## פירוט כשלים',
        '',
        failures,
        ''
    ].join('\n');
}

function readGradeResults() {
    if (!fs.existsSync(GRADES_DIR)) {
        return [];
    }

    return fs.readdirSync(GRADES_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
            const fullPath = path.join(GRADES_DIR, file);
            try {
                return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            } catch (error) {
                return null;
            }
        })
        .filter((result) => Boolean(result?.name))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function writeSummaryFile(summaryFile) {
    const results = readGradeResults();
    const headers = [
        'שם',
        'סה"כ',
        'אנדפוינטים',
        'איכות קוד',
        ...endpoints,
        'FastAPI',
        'JSON file',
        'Logger',
        'HTTPException'
    ];

    const rows = results.map((result) => [
        result.name,
        result.total,
        result.endpoint_points,
        result.code_quality_points,
        ...endpoints.map((endpoint) => result[endpoint] ?? 0),
        result.code_requirements?.fastapi_server_runs ?? 0,
        result.code_requirements?.json_file_database ?? 0,
        result.code_requirements?.logger_usage ?? 0,
        result.code_requirements?.http_exception_usage ?? 0
    ]);

    const content = [
        '# סיכום ציונים',
        '',
        `עודכן לאחרונה: ${new Date().toISOString()}`,
        '',
        markdownTable(headers, rows),
        ''
    ].join('\n');

    fs.writeFileSync(summaryFile, content);
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

function isWeaponLike(weapon) {
    return weapon &&
        typeof weapon === 'object' &&
        weapon.id !== undefined &&
        REQUIRED_FIELDS.every((field) => typeof weapon[field] === 'string');
}

async function getApiWeaponsForExpectedData() {
    resetWeaponsFile();
    const weapons = await http.get('/weapons');
    return Array.isArray(weapons) ? weapons : [];
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
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch (error) {
            data = text;
        }
    }

    if (!res.ok) {
        const message = data?.detail || data?.message || data?.error || data || res.statusText;
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
        http_exception_evidence: null,
        validation_results: [],
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
    grades.http_exception_evidence = {
        uses_http_exception: usesHttpException,
        imports_http_exception: importsHttpException,
        returns_error_object: returnsErrorObject
    };

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

function deductEndpointPoint(grades, endpoint, reason, requestInfo, details = {}) {
    const before = grades[endpoint] || 0;
    grades[endpoint] = Math.max(0, before - 1);

    addFailure(grades, endpoint, 'invalid input validation', requestInfo, reason, {
        deducted: before > grades[endpoint],
        score_before: before,
        score_after: grades[endpoint],
        ...details
    });

    return before > grades[endpoint];
}

function addValidationResult(grades, endpoint, test, deducted, details = {}) {
    grades.validation_results.push({
        endpoint,
        test,
        deducted,
        ...details
    });
}

function isExpectedValidationError(error, statuses = [400, 404, 422]) {
    return error instanceof HttpError && statuses.includes(error.status);
}

async function gradeValidationCases(grades) {
    try {
        const body = {type: 'rifle', ammo_type: '5.56mm', condition: 'new'};
        resetWeaponsFile();
        await http.post('/weapons', body);
        const requestInfo = {method: 'POST', route: '/weapons', body};
        const deducted = deductEndpointPoint(grades, 'POST /weapons', 'Invalid missing required field request succeeded instead of returning an error', requestInfo);
        addValidationResult(grades, 'POST /weapons', 'POST missing required field should error', deducted, {status: 'succeeded'});
    } catch (error) {
        const accepted = isExpectedValidationError(error, [400, 422]);
        addValidationResult(grades, 'POST /weapons', 'POST missing required field should error', false, {
            accepted,
            ...errorDetails(error)
        });

        if (!accepted) {
            addFailure(grades, 'POST /weapons', 'invalid input validation', {method: 'POST', route: '/weapons'}, 'Missing required field returned an unexpected error status', errorDetails(error));
        }
    }

    const extraFieldBody = {
        type: 'rifle',
        model: `EXTRA-FIELD-${RUN_ID}`,
        ammo_type: '5.56mm',
        condition: 'new',
        forbidden_field: 'should-not-be-saved'
    };

    try {
        resetWeaponsFile();
        await http.post('/weapons', extraFieldBody);
        const after = await http.get('/weapons');
        const created = Array.isArray(after)
            ? after.find((weapon) => weapon.model === extraFieldBody.model)
            : null;
        const accepted = Boolean(created && created.forbidden_field === undefined);
        const deducted = accepted
            ? false
            : deductEndpointPoint(grades, 'POST /weapons', 'Extra field was accepted and saved instead of being rejected or ignored', {method: 'POST', route: '/weapons', body: extraFieldBody});

        addValidationResult(grades, 'POST /weapons', 'POST extra field should error or be ignored', deducted, {
            accepted,
            behavior: 'ignored_extra_field',
            created_without_extra_field: accepted
        });
    } catch (error) {
        const accepted = isExpectedValidationError(error, [400, 422]);
        addValidationResult(grades, 'POST /weapons', 'POST extra field should error or be ignored', false, {
            accepted,
            behavior: 'error_for_extra_field',
            ...errorDetails(error)
        });

        if (!accepted) {
            addFailure(grades, 'POST /weapons', 'invalid input validation', {method: 'POST', route: '/weapons', body: extraFieldBody}, 'Extra field returned an unexpected error status', errorDetails(error));
        }
    }
}

async function gradeGetWeapons(grades) {
    try {
        resetWeaponsFile();
        const response = await http.get('/weapons');
        const isList = Array.isArray(response);
        const containsCompleteWeapons = isList && response.length > 0 && response.every(isWeaponLike);

        if (isList && containsCompleteWeapons) {
            grades['/weapons'] += 9;
        }

        if (!isList) {
            addFailure(grades, '/weapons', 'valid response returns a list', {method: 'GET', route: '/weapons'}, 'Response was not an array');
        }

        if (!containsCompleteWeapons) {
            addFailure(grades, '/weapons', 'valid response contains complete weapon objects', {method: 'GET', route: '/weapons'}, 'Response did not contain complete weapon objects');
        }
    } catch (error) {
        addFailure(grades, '/weapons', 'valid GET /weapons request', {method: 'GET', route: '/weapons'}, 'Request failed', errorDetails(error));
        console.log('GET /weapons failed:', error.message);
    }
}

async function gradeGetWeaponById(grades) {
    try {
        const weapons = await getApiWeaponsForExpectedData();
        const expected = weapons[0];

        if (!expected) {
            throw new Error('GET /weapons did not return an existing weapon to test by id');
        }

        resetWeaponsFile();
        const response = await http.get(`/weapons/${expected.id}`);

        if (sameJson(response, expected)) {
            grades['/weapons/{id}'] += 9;
        } else {
            addFailure(grades, '/weapons/{id}', 'valid id returns matching weapon', {method: 'GET', route: `/weapons/${expected.id}`}, 'Response did not match the weapon returned by GET /weapons');
        }
    } catch (error) {
        addFailure(grades, '/weapons/{id}', 'valid id returns matching weapon', {method: 'GET', route: '/weapons/{existing_id}'}, 'Request failed', errorDetails(error));
        console.log('GET /weapons/{id} valid case failed:', error.message);
    }
}

async function gradePostWeapon(grades) {
    const weapon = {
        type: 'machine_gun',
        model: `POST-GRADE-MAG-${RUN_ID}`,
        ammo_type: '7.62mm',
        condition: 'good'
    };

    try {
        const before = await getApiWeaponsForExpectedData();
        const expectedId = maxId(before) + 1;
        resetWeaponsFile();
        const response = await http.post('/weapons', weapon);
        resetWeaponsFile();
        const after = await http.get('/weapons');
        const created = after.find((item) => item.id === expectedId);
        const requestSucceeded = response !== undefined;
        let validPostPassed = false;

        if (
            created &&
            after.length === before.length + 1 &&
            created.id === expectedId &&
            REQUIRED_FIELDS.every((field) => created[field] === weapon[field])
        ) {
            grades['POST /weapons'] += 5;
            validPostPassed = true;
        } else {
            addFailure(grades, 'POST /weapons', 'valid POST creates weapon with server id', {method: 'POST', route: '/weapons', body: weapon}, 'Created weapon was not found in API data with expected id or expected fields', {
                expected_id: expectedId
            });
        }

        if (validPostPassed && requestSucceeded && created && containsWeapon(after, created)) {
            grades['POST /weapons'] += 4;
        } else if (validPostPassed) {
            addFailure(grades, 'POST /weapons', 'valid POST is visible through API', {method: 'GET', route: '/weapons'}, 'Created weapon was not visible through GET /weapons');
        }
    } catch (error) {
        addFailure(grades, 'POST /weapons', 'valid POST creates weapon with server id', {method: 'POST', route: '/weapons', body: weapon}, 'Request failed', errorDetails(error));
        console.log('POST /weapons valid case failed:', error.message);
    }
}

async function gradePutWeapon(grades) {
    try {
        const before = await getApiWeaponsForExpectedData();
        const target = before.find((weapon) => weapon.condition !== 'critical') || before[0];
        const update = {
            type: target.type,
            model: `PUT-GRADE-UPDATED-${RUN_ID}`,
            ammo_type: target.ammo_type,
            condition: 'critical'
        };

        resetWeaponsFile();
        const response = await http.put(`/weapons/${target.id}`, update);
        resetWeaponsFile();
        const after = await http.get('/weapons');
        const updated = after.find((weapon) => weapon.id === target.id);
        const requestSucceeded = response !== undefined;
        let validUpdatePassed = false;

        if (
            updated &&
            requestSucceeded &&
            after.length === before.length &&
            updated.model === update.model &&
            updated.condition === update.condition
        ) {
            grades['PUT /weapons/{id}'] += 5;
            validUpdatePassed = true;
        } else {
            addFailure(grades, 'PUT /weapons/{id}', 'valid PUT updates existing weapon', {method: 'PUT', route: `/weapons/${target.id}`, body: update}, 'Weapon was not updated as expected or a new item was created');
        }

        const otherItemsUnchanged = before
            .filter((weapon) => weapon.id !== target.id)
            .every((weapon) => sameJson(weapon, after.find((item) => item.id === weapon.id)));

        if (validUpdatePassed && otherItemsUnchanged && sameJson(after.find((weapon) => weapon.id === target.id), updated)) {
            grades['PUT /weapons/{id}'] += 4;
        } else if (validUpdatePassed) {
            addFailure(grades, 'PUT /weapons/{id}', 'valid PUT only changes target and is visible through API', {method: 'GET', route: '/weapons'}, 'Other items changed or update was not visible through GET /weapons');
        }
    } catch (error) {
        addFailure(grades, 'PUT /weapons/{id}', 'valid PUT updates existing weapon', {method: 'PUT', route: '/weapons/{existing_id}'}, 'Request failed', errorDetails(error));
        console.log('PUT /weapons/{id} valid case failed:', error.message);
    }
}

async function gradeDeleteWeapon(grades) {
    let deletedId;

    try {
        const before = await getApiWeaponsForExpectedData();
        const target = before.find((weapon) => weapon && weapon.id !== undefined);

        if (!target || !before.some((weapon) => weapon.id === target.id)) {
            throw new Error('No existing weapon found in weapons.json for delete test');
        }

        deletedId = target.id;
        resetWeaponsFile();
        await http.delete(`/weapons/${target.id}`);
        resetWeaponsFile();
        const after = await http.get('/weapons');
        let validDeletePassed = false;

        if (after.length === before.length - 1 && !after.some((weapon) => weapon.id === target.id)) {
            grades['DELETE /weapons/{id}'] += 5;
            validDeletePassed = true;
        } else {
            addFailure(grades, 'DELETE /weapons/{id}', 'valid DELETE removes existing weapon', {method: 'DELETE', route: `/weapons/${target.id}`}, 'Target weapon was not removed from API data');
        }

        const onlyTargetDeleted = before
            .filter((weapon) => weapon.id !== target.id)
            .every((weapon) => sameJson(weapon, after.find((item) => item.id === weapon.id)));

        if (validDeletePassed && onlyTargetDeleted && !after.some((weapon) => weapon.id === target.id)) {
            grades['DELETE /weapons/{id}'] += 4;
        } else if (validDeletePassed) {
            addFailure(grades, 'DELETE /weapons/{id}', 'valid DELETE removes only target and is visible through API', {method: 'GET', route: '/weapons'}, 'Other items changed or delete was not visible through GET /weapons');
        }
    } catch (error) {
        addFailure(grades, 'DELETE /weapons/{id}', 'valid DELETE removes existing weapon', {method: 'DELETE', route: deletedId ? `/weapons/${deletedId}` : '/weapons/{existing_id}'}, 'Request failed', errorDetails(error));
        console.log('DELETE /weapons/{id} valid case failed:', error.message);
    }
}

async function gradeByCondition(grades) {
    try {
        const weapons = await getApiWeaponsForExpectedData();
        const condition = 'damaged';
        const expected = weapons.filter((weapon) => weapon.condition === condition);
        resetWeaponsFile();
        const response = await http.get(`/weapons/by-condition?condition=${condition}`);
        let validConditionPassed = false;

        if (sameJson(response, expected)) {
            grades['/weapons/by-condition'] += 5;
            validConditionPassed = true;
        } else {
            addFailure(grades, '/weapons/by-condition', 'valid condition returns matching weapons', {method: 'GET', route: `/weapons/by-condition?condition=${condition}`}, 'Response did not match weapons with requested condition', {
                expected_count: expected.length,
                actual_count: Array.isArray(response) ? response.length : null
            });
        }

        if (validConditionPassed && Array.isArray(response) && response.every((weapon) => weapon.condition === condition)) {
            grades['/weapons/by-condition'] += 4;
        } else if (validConditionPassed) {
            addFailure(grades, '/weapons/by-condition', 'all returned weapons have requested condition', {method: 'GET', route: `/weapons/by-condition?condition=${condition}`}, 'Some returned weapons had a different condition');
        }
    } catch (error) {
        addFailure(grades, '/weapons/by-condition', 'valid condition returns matching weapons', {method: 'GET', route: '/weapons/by-condition?condition=damaged'}, 'Request failed', errorDetails(error));
        console.log('GET /weapons/by-condition valid case failed:', error.message);
    }
}

async function gradeCombatReady(grades) {
    try {
        const weapons = await getApiWeaponsForExpectedData();
        const type = 'machine_gun';
        const expected = weapons.filter((weapon) => weapon.type === type && ['new', 'good'].includes(weapon.condition));
        resetWeaponsFile();
        const response = await http.get(`/weapons/combat-ready?type=${type}`);
        let validCombatReadyPassed = false;

        if (sameJson(response, expected)) {
            grades['/weapons/combat-ready'] += 5;
            validCombatReadyPassed = true;
        } else {
            addFailure(grades, '/weapons/combat-ready', 'valid type returns only combat-ready weapons', {method: 'GET', route: `/weapons/combat-ready?type=${type}`}, 'Response did not match weapons with requested type and condition new/good', {
                expected_count: expected.length,
                actual_count: Array.isArray(response) ? response.length : null
            });
        }

        if (validCombatReadyPassed && Array.isArray(response) && response.every((weapon) => weapon.type === type)) {
            grades['/weapons/combat-ready'] += 2;
        } else if (validCombatReadyPassed) {
            addFailure(grades, '/weapons/combat-ready', 'all returned weapons have requested type', {method: 'GET', route: `/weapons/combat-ready?type=${type}`}, 'Some returned weapons had a different type');
        }

        if (validCombatReadyPassed && Array.isArray(response) && response.every((weapon) => ['new', 'good'].includes(weapon.condition))) {
            grades['/weapons/combat-ready'] += 2;
        } else if (validCombatReadyPassed) {
            addFailure(grades, '/weapons/combat-ready', 'all returned weapons are combat ready', {method: 'GET', route: `/weapons/combat-ready?type=${type}`}, 'Some returned weapons were not new/good');
        }
    } catch (error) {
        addFailure(grades, '/weapons/combat-ready', 'valid type returns only combat-ready weapons', {method: 'GET', route: '/weapons/combat-ready?type=machine_gun'}, 'Request failed', errorDetails(error));
        console.log('GET /weapons/combat-ready valid case failed:', error.message);
    }
}

async function gradeSummaryByType(grades) {
    try {
        const before = await getApiWeaponsForExpectedData();
        const expected = countByType(before);
        resetWeaponsFile();
        const response = await http.get('/weapons/summary/by-type');

        if (sameJson(response, expected)) {
            grades['/weapons/summary/by-type'] += 9;
        } else {
            addFailure(grades, '/weapons/summary/by-type', 'valid summary by type', {method: 'GET', route: '/weapons/summary/by-type'}, 'Response did not match dynamic count by type');
        }
    } catch (error) {
        addFailure(grades, '/weapons/summary/by-type', 'valid summary by type', {method: 'GET', route: '/weapons/summary/by-type'}, 'Request failed', errorDetails(error));
        console.log('GET /weapons/summary/by-type failed:', error.message);
    }
}

async function gradeDeleteByCondition(grades) {
    const condition = 'critical';

    try {
        const before = await getApiWeaponsForExpectedData();
        const expectedRemaining = before.filter((weapon) => weapon.condition !== condition);
        const expectedDeletedCount = before.length - expectedRemaining.length;

        resetWeaponsFile();
        await http.delete(`/weapons/by-condition?condition=${condition}`);
        resetWeaponsFile();
        const after = await http.get('/weapons');
        let validDeleteByConditionPassed = false;

        if (expectedDeletedCount > 0 && sameJson(after, expectedRemaining)) {
            grades['DELETE /weapons/by-condition'] += 5;
            validDeleteByConditionPassed = true;
        } else {
            addFailure(grades, 'DELETE /weapons/by-condition', 'valid DELETE by condition removes matching weapons', {method: 'DELETE', route: `/weapons/by-condition?condition=${condition}`}, 'API data did not match expected remaining weapons after delete', {
                expected_deleted_count: expectedDeletedCount
            });
        }

        if (validDeleteByConditionPassed && !after.some((weapon) => weapon.condition === condition) && sameJson(after, expectedRemaining)) {
            grades['DELETE /weapons/by-condition'] += 3;
        } else if (validDeleteByConditionPassed) {
            addFailure(grades, 'DELETE /weapons/by-condition', 'valid DELETE by condition removes all matching weapons through API', {method: 'GET', route: '/weapons'}, 'Some matching weapons remained in API data');
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
    await gradeValidationCases(grades);
    gradeRuntimeLogger(grades, logSnapshotBefore);
    resetWeaponsFile();

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
