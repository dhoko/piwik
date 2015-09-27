/*
         * Piwik Tracker class
         *
         * trackerUrl and trackerSiteId are optional arguments to the constructor
         *
         * See: Tracker.setTrackerUrl() and Tracker.setSiteId()
         */
function Tracker(trackerUrl, siteId) {

    /************************************************************
     * Private members
     ************************************************************/

    var
/*<DEBUG>*/
        /*
         * registered test hooks
         */
        registeredHooks = {},
/*</DEBUG>*/

        // Current URL and Referrer URL
        locationArray = urlFixup(documentAlias.domain, windowAlias.location.href, getReferrer()),
        domainAlias = domainFixup(locationArray[0]),
        locationHrefAlias = safeDecodeWrapper(locationArray[1]),
        configReferrerUrl = safeDecodeWrapper(locationArray[2]),

        enableJSErrorTracking = false,

        defaultRequestMethod = 'GET',

        // Request method (GET or POST)
        configRequestMethod = defaultRequestMethod,

        defaultRequestContentType = 'application/x-www-form-urlencoded; charset=UTF-8',

        // Request Content-Type header value; applicable when POST request method is used for submitting tracking events
        configRequestContentType = defaultRequestContentType,

        // Tracker URL
        configTrackerUrl = trackerUrl || '',

        // API URL (only set if it differs from the Tracker URL)
        configApiUrl = '',

        // This string is appended to the Tracker URL Request (eg. to send data that is not handled by the existing setters/getters)
        configAppendToTrackingUrl = '',

        // Site ID
        configTrackerSiteId = siteId || '',

        // User ID
        configUserId = '',

        // Visitor UUID
        visitorUUID = '',

        // Document URL
        configCustomUrl,

        // Document title
        configTitle = documentAlias.title,

        // Extensions to be treated as download links
        configDownloadExtensions = ['7z','aac','apk','arc','arj','asf','asx','avi','azw3','bin','csv','deb','dmg','doc','docx','epub','exe','flv','gif','gz','gzip','hqx','ibooks','jar','jpg','jpeg','js','mobi','mp2','mp3','mp4','mpg','mpeg','mov','movie','msi','msp','odb','odf','odg','ods','odt','ogg','ogv','pdf','phps','png','ppt','pptx','qt','qtm','ra','ram','rar','rpm','sea','sit','tar','tbz','tbz2','bz','bz2','tgz','torrent','txt','wav','wma','wmv','wpd','xls','xlsx','xml','z','zip'],

        // Hosts or alias(es) to not treat as outlinks
        configHostsAlias = [domainAlias],

        // HTML anchor element classes to not track
        configIgnoreClasses = [],

        // HTML anchor element classes to treat as downloads
        configDownloadClasses = [],

        // HTML anchor element classes to treat at outlinks
        configLinkClasses = [],

        // Maximum delay to wait for web bug image to be fetched (in milliseconds)
        configTrackerPause = 500,

        // Minimum visit time after initial page view (in milliseconds)
        configMinimumVisitTime,

        // Recurring heart beat after initial ping (in milliseconds)
        configHeartBeatDelay,

        // alias to circumvent circular function dependency (JSLint requires this)
        heartBeatPingIfActivityAlias,

        // Disallow hash tags in URL
        configDiscardHashTag,

        // Custom data
        configCustomData,

        // Campaign names
        configCampaignNameParameters = [ 'pk_campaign', 'piwik_campaign', 'utm_campaign', 'utm_source', 'utm_medium' ],

        // Campaign keywords
        configCampaignKeywordParameters = [ 'pk_kwd', 'piwik_kwd', 'utm_term' ],

        // First-party cookie name prefix
        configCookieNamePrefix = '_pk_',

        // First-party cookie domain
        // User agent defaults to origin hostname
        configCookieDomain,

        // First-party cookie path
        // Default is user agent defined.
        configCookiePath,

        // Cookies are disabled
        configCookiesDisabled = false,

        // Do Not Track
        configDoNotTrack,

        // Count sites which are pre-rendered
        configCountPreRendered,

        // Do we attribute the conversion to the first referrer or the most recent referrer?
        configConversionAttributionFirstReferrer,

        // Life of the visitor cookie (in milliseconds)
        configVisitorCookieTimeout = 33955200000, // 13 months (365 days + 28days)

        // Life of the session cookie (in milliseconds)
        configSessionCookieTimeout = 1800000, // 30 minutes

        // Life of the referral cookie (in milliseconds)
        configReferralCookieTimeout = 15768000000, // 6 months

        // Is performance tracking enabled
        configPerformanceTrackingEnabled = true,

        // Generation time set from the server
        configPerformanceGenerationTime = 0,

        // Whether Custom Variables scope "visit" should be stored in a cookie during the time of the visit
        configStoreCustomVariablesInCookie = false,

        // Custom Variables read from cookie, scope "visit"
        customVariables = false,

        configCustomRequestContentProcessing,

        // Custom Variables, scope "page"
        customVariablesPage = {},

        // Custom Variables, scope "event"
        customVariablesEvent = {},

        // Custom Variables names and values are each truncated before being sent in the request or recorded in the cookie
        customVariableMaximumLength = 200,

        // Ecommerce items
        ecommerceItems = {},

        // Browser features via client-side data collection
        browserFeatures = {},

        // Keeps track of previously tracked content impressions
        trackedContentImpressions = [],
        isTrackOnlyVisibleContentEnabled = false,

        // Guard to prevent empty visits see #6415. If there is a new visitor and the first 2 (or 3 or 4)
        // tracking requests are at nearly same time (eg trackPageView and trackContentImpression) 2 or more
        // visits will be created
        timeNextTrackingRequestCanBeExecutedImmediately = false,

        // Guard against installing the link tracker more than once per Tracker instance
        linkTrackingInstalled = false,
        linkTrackingEnabled = false,

        // Guard against installing the activity tracker more than once per Tracker instance
        heartBeatSetUp = false,

        // Timestamp of last tracker request sent to Piwik
        lastTrackerRequestTime = null,

        // Handle to the current heart beat timeout
        heartBeatTimeout,

        // Internal state of the pseudo click handler
        lastButton,
        lastTarget,

        // Hash function
        hash = sha1,

        // Domain hash value
        domainHash;

    /*
     * Set cookie value
     */
    function setCookie(cookieName, value, msToExpire, path, domain, secure) {
        if (configCookiesDisabled) {
            return;
        }

        var expiryDate;

        // relative time to expire in milliseconds
        if (msToExpire) {
            expiryDate = new Date();
            expiryDate.setTime(expiryDate.getTime() + msToExpire);
        }

        documentAlias.cookie = cookieName + '=' + encodeWrapper(value) +
            (msToExpire ? ';expires=' + expiryDate.toGMTString() : '') +
            ';path=' + (path || '/') +
            (domain ? ';domain=' + domain : '') +
            (secure ? ';secure' : '');
    }

    /*
     * Get cookie value
     */
    function getCookie(cookieName) {
        if (configCookiesDisabled) {
            return 0;
        }

        var cookiePattern = new RegExp('(^|;)[ ]*' + cookieName + '=([^;]*)'),
            cookieMatch = cookiePattern.exec(documentAlias.cookie);

        return cookieMatch ? decodeWrapper(cookieMatch[2]) : 0;
    }

    /*
     * Removes hash tag from the URL
     *
     * URLs are purified before being recorded in the cookie,
     * or before being sent as GET parameters
     */
    function purify(url) {
        var targetPattern;

        if (configDiscardHashTag) {
            targetPattern = new RegExp('#.*');

            return url.replace(targetPattern, '');
        }

        return url;
    }

    /*
     * Resolve relative reference
     *
     * Note: not as described in rfc3986 section 5.2
     */
    function resolveRelativeReference(baseUrl, url) {
        var protocol = getProtocolScheme(url),
            i;

        if (protocol) {
            return url;
        }

        if (url.slice(0, 1) === '/') {
            return getProtocolScheme(baseUrl) + '://' + getHostName(baseUrl) + url;
        }

        baseUrl = purify(baseUrl);

        i = baseUrl.indexOf('?');
        if (i >= 0) {
            baseUrl = baseUrl.slice(0, i);
        }

        i = baseUrl.lastIndexOf('/');
        if (i !== baseUrl.length - 1) {
            baseUrl = baseUrl.slice(0, i + 1);
        }

        return baseUrl + url;
    }

    /*
     * Is the host local? (i.e., not an outlink)
     */
    function isSiteHostName(hostName) {
        var i,
            alias,
            offset;

        for (i = 0; i < configHostsAlias.length; i++) {
            alias = domainFixup(configHostsAlias[i].toLowerCase());

            if (hostName === alias) {
                return true;
            }

            if (alias.slice(0, 1) === '.') {
                if (hostName === alias.slice(1)) {
                    return true;
                }

                offset = hostName.length - alias.length;

                if ((offset > 0) && (hostName.slice(offset) === alias)) {
                    return true;
                }
            }
        }

        return false;
    }





    function setExpireDateTime(delay) {

        var now  = new Date();
        var time = now.getTime() + delay;

        if (!expireDateTime || time > expireDateTime) {
            expireDateTime = time;
        }
    }

    /*
     * Sets up the heart beat timeout.
     */
    function heartBeatUp(delay) {
        if (heartBeatTimeout
            || !configHeartBeatDelay
        ) {
            return;
        }

        heartBeatTimeout = setTimeout(function heartBeat() {
            heartBeatTimeout = null;
            if (heartBeatPingIfActivityAlias()) {
                return;
            }

            var now = new Date(),
                heartBeatDelay = configHeartBeatDelay - (now.getTime() - lastTrackerRequestTime);
            // sanity check
            heartBeatDelay = Math.min(configHeartBeatDelay, heartBeatDelay);
            heartBeatUp(heartBeatDelay);
        }, delay || configHeartBeatDelay);
    }

    /*
     * Removes the heart beat timeout.
     */
    function heartBeatDown() {
        if (!heartBeatTimeout) {
            return;
        }

        clearTimeout(heartBeatTimeout);
        heartBeatTimeout = null;
    }

    function heartBeatOnFocus() {
        // since it's possible for a user to come back to a tab after several hours or more, we try to send
        // a ping if the page is active. (after the ping is sent, the heart beat timeout will be set)
        if (heartBeatPingIfActivityAlias()) {
            return;
        }

        heartBeatUp();
    }

    function heartBeatOnBlur() {
        heartBeatDown();
    }

    /*
     * Setup event handlers and timeout for initial heart beat.
     */
    function setUpHeartBeat() {
        if (heartBeatSetUp
            || !configHeartBeatDelay
        ) {
            return;
        }

        heartBeatSetUp = true;

        addEventListener(windowAlias, 'focus', heartBeatOnFocus);
        addEventListener(windowAlias, 'blur', heartBeatOnBlur);

        heartBeatUp();
    }

    function makeSureThereIsAGapAfterFirstTrackingRequestToPreventMultipleVisitorCreation(callback)
    {
        var now     = new Date();
        var timeNow = now.getTime();

        lastTrackerRequestTime = timeNow;

        if (timeNextTrackingRequestCanBeExecutedImmediately && timeNow < timeNextTrackingRequestCanBeExecutedImmediately) {
            // we are in the time frame shortly after the first request. we have to delay this request a bit to make sure
            // a visitor has been created meanwhile.

            var timeToWait = timeNextTrackingRequestCanBeExecutedImmediately - timeNow;

            setTimeout(callback, timeToWait);
            setExpireDateTime(timeToWait + 50); // set timeout is not necessarily executed at timeToWait so delay a bit more
            timeNextTrackingRequestCanBeExecutedImmediately += 50; // delay next tracking request by further 50ms to next execute them at same time

            return;
        }

        if (timeNextTrackingRequestCanBeExecutedImmediately === false) {
            // it is the first request, we want to execute this one directly and delay all the next one(s) within a delay.
            // All requests after this delay can be executed as usual again
            var delayInMs = 800;
            timeNextTrackingRequestCanBeExecutedImmediately = timeNow + delayInMs;
        }

        callback();
    }



    /*
     * Get cookie name with prefix and domain hash
     */
    function getCookieName(baseName) {
        // NOTE: If the cookie name is changed, we must also update the PiwikTracker.php which
        // will attempt to discover first party cookies. eg. See the PHP Client method getVisitorId()
        return configCookieNamePrefix + baseName + '.' + configTrackerSiteId + '.' + domainHash;
    }

    /*
     * Does browser have cookies enabled (for this site)?
     */
    function hasCookies() {
        if (configCookiesDisabled) {
            return '0';
        }

        if (!isDefined(navigatorAlias.cookieEnabled)) {
            var testCookieName = getCookieName('testcookie');
            setCookie(testCookieName, '1');

            return getCookie(testCookieName) === '1' ? '1' : '0';
        }

        return navigatorAlias.cookieEnabled ? '1' : '0';
    }

    /*
     * Update domain hash
     */
    function updateDomainHash() {
        domainHash = hash((configCookieDomain || domainAlias) + (configCookiePath || '/')).slice(0, 4); // 4 hexits = 16 bits
    }

    /*
     * Inits the custom variables object
     */
    function getCustomVariablesFromCookie() {
        var cookieName = getCookieName('cvar'),
            cookie = getCookie(cookieName);

        if (cookie.length) {
            cookie = JSON2.parse(cookie);

            if (isObject(cookie)) {
                return cookie;
            }
        }

        return {};
    }

    /*
     * Lazy loads the custom variables from the cookie, only once during this page view
     */
    function loadCustomVariables() {
        if (customVariables === false) {
            customVariables = getCustomVariablesFromCookie();
        }
    }

    /*
     * Generate a pseudo-unique ID to fingerprint this user
     * 16 hexits = 64 bits
     * note: this isn't a RFC4122-compliant UUID
     */
    function generateRandomUuid() {
        return hash(
            (navigatorAlias.userAgent || '') +
            (navigatorAlias.platform || '') +
            JSON2.stringify(browserFeatures) +
            (new Date()).getTime() +
            Math.random()
        ).slice(0, 16);
    }

    /*
     * Load visitor ID cookie
     */
    function loadVisitorIdCookie() {
        var now = new Date(),
            nowTs = Math.round(now.getTime() / 1000),
            visitorIdCookieName = getCookieName('id'),
            id = getCookie(visitorIdCookieName),
            cookieValue,
            uuid;

        // Visitor ID cookie found
        if (id) {
            cookieValue = id.split('.');

            // returning visitor flag
            cookieValue.unshift('0');

            if(visitorUUID.length) {
                cookieValue[1] = visitorUUID;
            }
            return cookieValue;
        }

        if(visitorUUID.length) {
            uuid = visitorUUID;
        } else if ('0' === hasCookies()){
            uuid = '';
        } else {
            uuid = generateRandomUuid();
        }

        // No visitor ID cookie, let's create a new one
        cookieValue = [
            // new visitor
            '1',

            // uuid
            uuid,

            // creation timestamp - seconds since Unix epoch
            nowTs,

            // visitCount - 0 = no previous visit
            0,

            // current visit timestamp
            nowTs,

            // last visit timestamp - blank = no previous visit
            '',

            // last ecommerce order timestamp
            ''
        ];

        return cookieValue;
    }


    /**
     * Loads the Visitor ID cookie and returns a named array of values
     */
    function getValuesFromVisitorIdCookie() {
        var cookieVisitorIdValue = loadVisitorIdCookie(),
            newVisitor = cookieVisitorIdValue[0],
            uuid = cookieVisitorIdValue[1],
            createTs = cookieVisitorIdValue[2],
            visitCount = cookieVisitorIdValue[3],
            currentVisitTs = cookieVisitorIdValue[4],
            lastVisitTs = cookieVisitorIdValue[5];

        // case migrating from pre-1.5 cookies
        if (!isDefined(cookieVisitorIdValue[6])) {
            cookieVisitorIdValue[6] = "";
        }

        var lastEcommerceOrderTs = cookieVisitorIdValue[6];

        return {
            newVisitor: newVisitor,
            uuid: uuid,
            createTs: createTs,
            visitCount: visitCount,
            currentVisitTs: currentVisitTs,
            lastVisitTs: lastVisitTs,
            lastEcommerceOrderTs: lastEcommerceOrderTs
        };
    }


    function getRemainingVisitorCookieTimeout() {
        var now = new Date(),
            nowTs = now.getTime(),
            cookieCreatedTs = getValuesFromVisitorIdCookie().createTs;

        var createTs = parseInt(cookieCreatedTs, 10);
        var originalTimeout = (createTs * 1000) + configVisitorCookieTimeout - nowTs;
        return originalTimeout;
    }

    /*
     * Sets the Visitor ID cookie
     */
    function setVisitorIdCookie(visitorIdCookieValues) {

        if(!configTrackerSiteId) {
            // when called before Site ID was set
            return;
        }

        var now = new Date(),
            nowTs = Math.round(now.getTime() / 1000);

        if(!isDefined(visitorIdCookieValues)) {
            visitorIdCookieValues = getValuesFromVisitorIdCookie();
        }

        var cookieValue = visitorIdCookieValues.uuid + '.' +
            visitorIdCookieValues.createTs + '.' +
            visitorIdCookieValues.visitCount + '.' +
            nowTs + '.' +
            visitorIdCookieValues.lastVisitTs + '.' +
            visitorIdCookieValues.lastEcommerceOrderTs;

        setCookie(getCookieName('id'), cookieValue, getRemainingVisitorCookieTimeout(), configCookiePath, configCookieDomain);
    }

    /*
     * Loads the referrer attribution information
     *
     * @returns array
     *  0: campaign name
     *  1: campaign keyword
     *  2: timestamp
     *  3: raw URL
     */
    function loadReferrerAttributionCookie() {
        // NOTE: if the format of the cookie changes,
        // we must also update JS tests, PHP tracker, System tests,
        // and notify other tracking clients (eg. Java) of the changes
        var cookie = getCookie(getCookieName('ref'));

        if (cookie.length) {
            try {
                cookie = JSON2.parse(cookie);
                if (isObject(cookie)) {
                    return cookie;
                }
            } catch (ignore) {
                // Pre 1.3, this cookie was not JSON encoded
            }
        }

        return [
            '',
            '',
            0,
            ''
        ];
    }

    function deleteCookie(cookieName, path, domain) {
        setCookie(cookieName, '', -86400, path, domain);
    }

    function isPossibleToSetCookieOnDomain(domainToTest)
    {
        var valueToSet = 'testvalue';
        setCookie('test', valueToSet, 10000, null, domainToTest);

        if (getCookie('test') === valueToSet) {
            deleteCookie('test', null, domainToTest);

            return true;
        }

        return false;
    }

    function deleteCookies() {
        var savedConfigCookiesDisabled = configCookiesDisabled;

        // Temporarily allow cookies just to delete the existing ones
        configCookiesDisabled = false;

        var cookiesToDelete = ['id', 'ses', 'cvar', 'ref'];
        var index, cookieName;

        for (index = 0; index < cookiesToDelete.length; index++) {
            cookieName = getCookieName(cookiesToDelete[index]);
            if (0 !== getCookie(cookieName)) {
                deleteCookie(cookieName, configCookiePath, configCookieDomain);
            }
        }

        configCookiesDisabled = savedConfigCookiesDisabled;
    }

    function setSiteId(siteId) {
        configTrackerSiteId = siteId;
        setVisitorIdCookie();
    }

    function sortObjectByKeys(value) {
        if (!value || !isObject(value)) {
            return;
        }

        // Object.keys(value) is not supported by all browsers, we get the keys manually
        var keys = [];
        var key;

        for (key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                keys.push(key);
            }
        }

        var normalized = {};
        keys.sort();
        var len = keys.length;
        var i;

        for (i = 0; i < len; i++) {
            normalized[keys[i]] = value[keys[i]];
        }

        return normalized;
    }

    /**
     * Creates the session cookie
     */
    function setSessionCookie() {
        setCookie(getCookieName('ses'), '*', configSessionCookieTimeout, configCookiePath, configCookieDomain);
    }

    /**
     * Returns the URL to call piwik.php,
     * with the standard parameters (plugins, resolution, url, referrer, etc.).
     * Sends the pageview and browser settings with every request in case of race conditions.
     */
    function getRequest(request, customData, pluginMethod, currentEcommerceOrderTs) {
        var i,
            now = new Date(),
            nowTs = Math.round(now.getTime() / 1000),
            referralTs,
            referralUrl,
            referralUrlMaxLength = 1024,
            currentReferrerHostName,
            originalReferrerHostName,
            customVariablesCopy = customVariables,
            cookieSessionName = getCookieName('ses'),
            cookieReferrerName = getCookieName('ref'),
            cookieCustomVariablesName = getCookieName('cvar'),
            cookieSessionValue = getCookie(cookieSessionName),
            attributionCookie = loadReferrerAttributionCookie(),
            currentUrl = configCustomUrl || locationHrefAlias,
            campaignNameDetected,
            campaignKeywordDetected;

        if (configCookiesDisabled) {
            deleteCookies();
        }

        if (configDoNotTrack) {
            return '';
        }

        var cookieVisitorIdValues = getValuesFromVisitorIdCookie();
        if (!isDefined(currentEcommerceOrderTs)) {
            currentEcommerceOrderTs = "";
        }

        // send charset if document charset is not utf-8. sometimes encoding
        // of urls will be the same as this and not utf-8, which will cause problems
        // do not send charset if it is utf8 since it's assumed by default in Piwik
        var charSet = documentAlias.characterSet || documentAlias.charset;

        if (!charSet || charSet.toLowerCase() === 'utf-8') {
            charSet = null;
        }

        campaignNameDetected = attributionCookie[0];
        campaignKeywordDetected = attributionCookie[1];
        referralTs = attributionCookie[2];
        referralUrl = attributionCookie[3];

        if (!cookieSessionValue) {
            // cookie 'ses' was not found: we consider this the start of a 'session'

            // here we make sure that if 'ses' cookie is deleted few times within the visit
            // and so this code path is triggered many times for one visit,
            // we only increase visitCount once per Visit window (default 30min)
            var visitDuration = configSessionCookieTimeout / 1000;
            if (!cookieVisitorIdValues.lastVisitTs
                || (nowTs - cookieVisitorIdValues.lastVisitTs) > visitDuration) {
                cookieVisitorIdValues.visitCount++;
                cookieVisitorIdValues.lastVisitTs = cookieVisitorIdValues.currentVisitTs;
            }


            // Detect the campaign information from the current URL
            // Only if campaign wasn't previously set
            // Or if it was set but we must attribute to the most recent one
            // Note: we are working on the currentUrl before purify() since we can parse the campaign parameters in the hash tag
            if (!configConversionAttributionFirstReferrer
                || !campaignNameDetected.length) {
                for (i in configCampaignNameParameters) {
                    if (Object.prototype.hasOwnProperty.call(configCampaignNameParameters, i)) {
                        campaignNameDetected = getParameter(currentUrl, configCampaignNameParameters[i]);

                        if (campaignNameDetected.length) {
                            break;
                        }
                    }
                }

                for (i in configCampaignKeywordParameters) {
                    if (Object.prototype.hasOwnProperty.call(configCampaignKeywordParameters, i)) {
                        campaignKeywordDetected = getParameter(currentUrl, configCampaignKeywordParameters[i]);

                        if (campaignKeywordDetected.length) {
                            break;
                        }
                    }
                }
            }

            // Store the referrer URL and time in the cookie;
            // referral URL depends on the first or last referrer attribution
            currentReferrerHostName = getHostName(configReferrerUrl);
            originalReferrerHostName = referralUrl.length ? getHostName(referralUrl) : '';

            if (currentReferrerHostName.length && // there is a referrer
                !isSiteHostName(currentReferrerHostName) && // domain is not the current domain
                (!configConversionAttributionFirstReferrer || // attribute to last known referrer
                !originalReferrerHostName.length || // previously empty
                isSiteHostName(originalReferrerHostName))) { // previously set but in current domain
                referralUrl = configReferrerUrl;
            }

            // Set the referral cookie if we have either a Referrer URL, or detected a Campaign (or both)
            if (referralUrl.length
                || campaignNameDetected.length) {
                referralTs = nowTs;
                attributionCookie = [
                    campaignNameDetected,
                    campaignKeywordDetected,
                    referralTs,
                    purify(referralUrl.slice(0, referralUrlMaxLength))
                ];

                setCookie(cookieReferrerName, JSON2.stringify(attributionCookie), configReferralCookieTimeout, configCookiePath, configCookieDomain);
            }
        }

        // build out the rest of the request
        request += '&idsite=' + configTrackerSiteId +
        '&rec=1' +
        '&r=' + String(Math.random()).slice(2, 8) + // keep the string to a minimum
        '&h=' + now.getHours() + '&m=' + now.getMinutes() + '&s=' + now.getSeconds() +
        '&url=' + encodeWrapper(purify(currentUrl)) +
        (configReferrerUrl.length ? '&urlref=' + encodeWrapper(purify(configReferrerUrl)) : '') +
        ((configUserId && configUserId.length) ? '&uid=' + encodeWrapper(configUserId) : '') +
        '&_id=' + cookieVisitorIdValues.uuid + '&_idts=' + cookieVisitorIdValues.createTs + '&_idvc=' + cookieVisitorIdValues.visitCount +
        '&_idn=' + cookieVisitorIdValues.newVisitor + // currently unused
        (campaignNameDetected.length ? '&_rcn=' + encodeWrapper(campaignNameDetected) : '') +
        (campaignKeywordDetected.length ? '&_rck=' + encodeWrapper(campaignKeywordDetected) : '') +
        '&_refts=' + referralTs +
        '&_viewts=' + cookieVisitorIdValues.lastVisitTs +
        (String(cookieVisitorIdValues.lastEcommerceOrderTs).length ? '&_ects=' + cookieVisitorIdValues.lastEcommerceOrderTs : '') +
        (String(referralUrl).length ? '&_ref=' + encodeWrapper(purify(referralUrl.slice(0, referralUrlMaxLength))) : '') +
        (charSet ? '&cs=' + encodeWrapper(charSet) : '') +
        '&send_image=0';

        // browser features
        for (i in browserFeatures) {
            if (Object.prototype.hasOwnProperty.call(browserFeatures, i)) {
                request += '&' + i + '=' + browserFeatures[i];
            }
        }

        // custom data
        if (customData) {
            request += '&data=' + encodeWrapper(JSON2.stringify(customData));
        } else if (configCustomData) {
            request += '&data=' + encodeWrapper(JSON2.stringify(configCustomData));
        }

        // Custom Variables, scope "page"
        function appendCustomVariablesToRequest(customVariables, parameterName) {
            var customVariablesStringified = JSON2.stringify(customVariables);
            if (customVariablesStringified.length > 2) {
                return '&' + parameterName + '=' + encodeWrapper(customVariablesStringified);
            }
            return '';
        }

        var sortedCustomVarPage = sortObjectByKeys(customVariablesPage);
        var sortedCustomVarEvent = sortObjectByKeys(customVariablesEvent);

        request += appendCustomVariablesToRequest(sortedCustomVarPage, 'cvar');
        request += appendCustomVariablesToRequest(sortedCustomVarEvent, 'e_cvar');

        // Custom Variables, scope "visit"
        if (customVariables) {
            request += appendCustomVariablesToRequest(customVariables, '_cvar');

            // Don't save deleted custom variables in the cookie
            for (i in customVariablesCopy) {
                if (Object.prototype.hasOwnProperty.call(customVariablesCopy, i)) {
                    if (customVariables[i][0] === '' || customVariables[i][1] === '') {
                        delete customVariables[i];
                    }
                }
            }

            if (configStoreCustomVariablesInCookie) {
                setCookie(cookieCustomVariablesName, JSON2.stringify(customVariables), configSessionCookieTimeout, configCookiePath, configCookieDomain);
            }
        }

        // performance tracking
        if (configPerformanceTrackingEnabled) {
            if (configPerformanceGenerationTime) {
                request += '&gt_ms=' + configPerformanceGenerationTime;
            } else if (performanceAlias && performanceAlias.timing
                && performanceAlias.timing.requestStart && performanceAlias.timing.responseEnd) {
                request += '&gt_ms=' + (performanceAlias.timing.responseEnd - performanceAlias.timing.requestStart);
            }
        }

        // update cookies
        cookieVisitorIdValues.lastEcommerceOrderTs = isDefined(currentEcommerceOrderTs) && String(currentEcommerceOrderTs).length ? currentEcommerceOrderTs : cookieVisitorIdValues.lastEcommerceOrderTs;
        setVisitorIdCookie(cookieVisitorIdValues);
        setSessionCookie();

        // tracker plugin hook
        request += executePluginMethod(pluginMethod);

        if (configAppendToTrackingUrl.length) {
            request += '&' + configAppendToTrackingUrl;
        }

        if (isFunction(configCustomRequestContentProcessing)) {
            request = configCustomRequestContentProcessing(request);
        }

        return request;
    }

    /*
     * If there was user activity since the last check, and it's been configHeartBeatDelay seconds
     * since the last tracker, send a ping request (the heartbeat timeout will be reset by sendRequest).
     */
    heartBeatPingIfActivityAlias = function heartBeatPingIfActivity() {
        var now = new Date();
        if (lastTrackerRequestTime + configHeartBeatDelay <= now.getTime()) {
            var requestPing = getRequest('ping=1', null, 'ping');
            sendRequest(requestPing, configTrackerPause);

            return true;
        }

        return false;
    };

    /*
     * Construct regular expression of classes
     */
    function getClassesRegExp(configClasses, defaultClass) {
        var i,
            classesRegExp = '(^| )(piwik[_-]' + defaultClass;

        if (configClasses) {
            for (i = 0; i < configClasses.length; i++) {
                classesRegExp += '|' + configClasses[i];
            }
        }

        classesRegExp += ')( |$)';

        return new RegExp(classesRegExp);
    }

    function startsUrlWithTrackerUrl(url) {
        return (configTrackerUrl && url && 0 === String(url).indexOf(configTrackerUrl));
    }

    /*
     * Link or Download?
     */
    function getLinkType(className, href, isInLink, hasDownloadAttribute) {
        if (startsUrlWithTrackerUrl(href)) {
            return 0;
        }

        // does class indicate whether it is an (explicit/forced) outlink or a download?
        var downloadPattern = getClassesRegExp(configDownloadClasses, 'download'),
            linkPattern = getClassesRegExp(configLinkClasses, 'link'),

        // does file extension indicate that it is a download?
            downloadExtensionsPattern = new RegExp('\\.(' + configDownloadExtensions.join('|') + ')([?&#]|$)', 'i');

        if (linkPattern.test(className)) {
            return 'link';
        }

        if (hasDownloadAttribute || downloadPattern.test(className) || downloadExtensionsPattern.test(href)) {
            return 'download';
        }

        if (isInLink) {
            return 0;
        }

        return 'link';
    }

    function getSourceElement(sourceElement)
    {
        var parentElement;

        parentElement = sourceElement.parentNode;
        while (parentElement !== null &&
            /* buggy IE5.5 */
        isDefined(parentElement)) {

            if (query.isLinkElement(sourceElement)) {
                break;
            }
            sourceElement = parentElement;
            parentElement = sourceElement.parentNode;
        }

        return sourceElement;
    }

    function getLinkIfShouldBeProcessed(sourceElement)
    {
        sourceElement = getSourceElement(sourceElement);

        if (!query.hasNodeAttribute(sourceElement, 'href')) {
            return;
        }

        if (!isDefined(sourceElement.href)) {
            return;
        }

        var href = query.getAttributeValueFromNode(sourceElement, 'href');

        if (startsUrlWithTrackerUrl(href)) {
            return;
        }

        // browsers, such as Safari, don't downcase hostname and href
        var originalSourceHostName = sourceElement.hostname || getHostName(sourceElement.href);
        var sourceHostName = originalSourceHostName.toLowerCase();
        var sourceHref = sourceElement.href.replace(originalSourceHostName, sourceHostName);

        // browsers, such as Safari, don't downcase hostname and href
        var scriptProtocol = new RegExp('^(javascript|vbscript|jscript|mocha|livescript|ecmascript|mailto):', 'i');

        if (!scriptProtocol.test(sourceHref)) {
            // track outlinks and all downloads
            var linkType = getLinkType(sourceElement.className, sourceHref, isSiteHostName(sourceHostName), query.hasNodeAttribute(sourceElement, 'download'));

            if (linkType) {
                return {
                    type: linkType,
                    href: sourceHref
                };
            }
        }
    }

    function buildContentInteractionRequest(interaction, name, piece, target)
    {
        var params = content.buildInteractionRequestParams(interaction, name, piece, target);

        if (!params) {
            return;
        }

        return getRequest(params, null, 'contentInteraction');
    }

    function buildContentInteractionTrackingRedirectUrl(url, contentInteraction, contentName, contentPiece, contentTarget)
    {
        if (!isDefined(url)) {
            return;
        }

        if (startsUrlWithTrackerUrl(url)) {
            return url;
        }

        var redirectUrl = content.toAbsoluteUrl(url);
        var request  = 'redirecturl=' + encodeWrapper(redirectUrl) + '&';
        request     += buildContentInteractionRequest(contentInteraction, contentName, contentPiece, (contentTarget || url));

        var separator = '&';
        if (configTrackerUrl.indexOf('?') < 0) {
            separator = '?';
        }

        return configTrackerUrl + separator + request;
    }

    function isNodeAuthorizedToTriggerInteraction(contentNode, interactedNode)
    {
        if (!contentNode || !interactedNode) {
            return false;
        }

        var targetNode = content.findTargetNode(contentNode);

        if (content.shouldIgnoreInteraction(targetNode)) {
            // interaction should be ignored
            return false;
        }

        targetNode = content.findTargetNodeNoDefault(contentNode);
        if (targetNode && !containsNodeElement(targetNode, interactedNode)) {
            /**
             * There is a target node defined but the clicked element is not within the target node. example:
             * <div data-track-content><a href="Y" data-content-target>Y</a><img src=""/><a href="Z">Z</a></div>
             *
             * The user clicked in this case on link Z and not on target Y
             */
            return false;
        }

        return true;
    }

    function getContentInteractionToRequestIfPossible (anyNode, interaction, fallbackTarget)
    {
        if (!anyNode) {
            return;
        }

        var contentNode = content.findParentContentNode(anyNode);

        if (!contentNode) {
            // we are not within a content block
            return;
        }

        if (!isNodeAuthorizedToTriggerInteraction(contentNode, anyNode)) {
            return;
        }

        var contentBlock = content.buildContentBlock(contentNode);

        if (!contentBlock) {
            return;
        }

        if (!contentBlock.target && fallbackTarget) {
            contentBlock.target = fallbackTarget;
        }

        return content.buildInteractionRequestParams(interaction, contentBlock.name, contentBlock.piece, contentBlock.target);
    }

    function wasContentImpressionAlreadyTracked(contentBlock)
    {
        if (!trackedContentImpressions || !trackedContentImpressions.length) {
            return false;
        }

        var index, trackedContent;

        for (index = 0; index < trackedContentImpressions.length; index++) {
            trackedContent = trackedContentImpressions[index];

            if (trackedContent &&
                trackedContent.name === contentBlock.name &&
                trackedContent.piece === contentBlock.piece &&
                trackedContent.target === contentBlock.target) {
                return true;
            }
        }

        return false;
    }

    function replaceHrefIfInternalLink(contentBlock)
    {
        if (!contentBlock) {
            return false;
        }

        var targetNode = content.findTargetNode(contentBlock);

        if (!targetNode || content.shouldIgnoreInteraction(targetNode)) {
            return false;
        }

        var link = getLinkIfShouldBeProcessed(targetNode);
        if (linkTrackingEnabled && link && link.type) {

            return false; // will be handled via outlink or download.
        }

        if (query.isLinkElement(targetNode) &&
            query.hasNodeAttributeWithValue(targetNode, 'href')) {
            var url = String(query.getAttributeValueFromNode(targetNode, 'href'));

            if (0 === url.indexOf('#')) {
                return false;
            }

            if (startsUrlWithTrackerUrl(url)) {
                return true;
            }

            if (!content.isUrlToCurrentDomain(url)) {
                return false;
            }

            var block = content.buildContentBlock(contentBlock);

            if (!block) {
                return;
            }

            var contentName   = block.name;
            var contentPiece  = block.piece;
            var contentTarget = block.target;

            if (!query.hasNodeAttributeWithValue(targetNode, content.CONTENT_TARGET_ATTR) || targetNode.wasContentTargetAttrReplaced) {
                // make sure we still track the correct content target when an interaction is happening
                targetNode.wasContentTargetAttrReplaced = true;
                contentTarget = content.toAbsoluteUrl(url);
                query.setAnyAttribute(targetNode, content.CONTENT_TARGET_ATTR, contentTarget);
            }

            var targetUrl = buildContentInteractionTrackingRedirectUrl(url, 'click', contentName, contentPiece, contentTarget);

            // location.href does not respect target=_blank so we prefer to use this
            content.setHrefAttribute(targetNode, targetUrl);

            return true;
        }

        return false;
    }

    function replaceHrefsIfInternalLink(contentNodes)
    {
        if (!contentNodes || !contentNodes.length) {
            return;
        }

        var index;
        for (index = 0; index < contentNodes.length; index++) {
            replaceHrefIfInternalLink(contentNodes[index]);
        }
    }

    function trackContentImpressionClickInteraction (targetNode)
    {
        return function (event) {

            if (!targetNode) {
                return;
            }

            var contentBlock = content.findParentContentNode(targetNode);

            var interactedElement;
            if (event) {
                interactedElement = event.target || event.srcElement;
            }
            if (!interactedElement) {
                interactedElement = targetNode;
            }

            if (!isNodeAuthorizedToTriggerInteraction(contentBlock, interactedElement)) {
                return;
            }

            setExpireDateTime(configTrackerPause);

            if (query.isLinkElement(targetNode) &&
                query.hasNodeAttributeWithValue(targetNode, 'href') &&
                query.hasNodeAttributeWithValue(targetNode, content.CONTENT_TARGET_ATTR)) {
                // there is a href attribute, the link was replaced with piwik.php but later the href was changed again by the application.
                var href = query.getAttributeValueFromNode(targetNode, 'href');
                if (!startsUrlWithTrackerUrl(href) && targetNode.wasContentTargetAttrReplaced) {
                    query.setAnyAttribute(targetNode, content.CONTENT_TARGET_ATTR, '');
                }
            }

            var link = getLinkIfShouldBeProcessed(targetNode);

            if (linkTrackingInstalled && link && link.type) {
                // click ignore, will be tracked via processClick, we do not want to track it twice

                return link.type;
            }

            if (replaceHrefIfInternalLink(contentBlock)) {
                return 'href';
            }

            var block = content.buildContentBlock(contentBlock);

            if (!block) {
                return;
            }

            var contentName   = block.name;
            var contentPiece  = block.piece;
            var contentTarget = block.target;

            // click on any non link element, or on a link element that has not an href attribute or on an anchor
            var request = buildContentInteractionRequest('click', contentName, contentPiece, contentTarget);
            sendRequest(request, configTrackerPause);

            return request;
        };
    }

    function setupInteractionsTracking(contentNodes)
    {
        if (!contentNodes || !contentNodes.length) {
            return;
        }

        var index, targetNode;
        for (index = 0; index < contentNodes.length; index++) {
            targetNode = content.findTargetNode(contentNodes[index]);

            if (targetNode && !targetNode.contentInteractionTrackingSetupDone) {
                targetNode.contentInteractionTrackingSetupDone = true;

                addEventListener(targetNode, 'click', trackContentImpressionClickInteraction(targetNode));
            }
        }
    }

    /*
     * Log all content pieces
     */
    function buildContentImpressionsRequests(contents, contentNodes)
    {
        if (!contents || !contents.length) {
            return [];
        }

        var index, request;

        for (index = 0; index < contents.length; index++) {

            if (wasContentImpressionAlreadyTracked(contents[index])) {
                contents.splice(index, 1);
                index--;
            } else {
                trackedContentImpressions.push(contents[index]);
            }
        }

        if (!contents || !contents.length) {
            return [];
        }

        replaceHrefsIfInternalLink(contentNodes);
        setupInteractionsTracking(contentNodes);

        var requests = [];

        for (index = 0; index < contents.length; index++) {

            request = getRequest(
                content.buildImpressionRequestParams(contents[index].name, contents[index].piece, contents[index].target),
                undefined,
                'contentImpressions'
            );

            requests.push(request);
        }

        return requests;
    }

    /*
     * Log all content pieces
     */
    function getContentImpressionsRequestsFromNodes(contentNodes)
    {
        var contents = content.collectContent(contentNodes);

        return buildContentImpressionsRequests(contents, contentNodes);
    }

    /*
     * Log currently visible content pieces
     */
    function getCurrentlyVisibleContentImpressionsRequestsIfNotTrackedYet(contentNodes)
    {
        if (!contentNodes || !contentNodes.length) {
            return [];
        }

        var index;

        for (index = 0; index < contentNodes.length; index++) {
            if (!content.isNodeVisible(contentNodes[index])) {
                contentNodes.splice(index, 1);
                index--;
            }
        }

        if (!contentNodes || !contentNodes.length) {
            return [];
        }

        return getContentImpressionsRequestsFromNodes(contentNodes);
    }

    function buildContentImpressionRequest(contentName, contentPiece, contentTarget)
    {
        var params = content.buildImpressionRequestParams(contentName, contentPiece, contentTarget);

        return getRequest(params, null, 'contentImpression');
    }

    function buildContentInteractionRequestNode(node, contentInteraction)
    {
        if (!node) {
            return;
        }

        var contentNode  = content.findParentContentNode(node);
        var contentBlock = content.buildContentBlock(contentNode);

        if (!contentBlock) {
            return;
        }

        if (!contentInteraction) {
            contentInteraction = 'Unknown';
        }

        return buildContentInteractionRequest(contentInteraction, contentBlock.name, contentBlock.piece, contentBlock.target);
    }






    /*
     * Log the goal with the server
     */
    function logGoal(idGoal, customRevenue, customData) {
        var request = getRequest('idgoal=' + idGoal + (customRevenue ? '&revenue=' + customRevenue : ''), customData, 'goal');

        sendRequest(request, configTrackerPause);
    }

    /*
     * Log the link or click with the server
     */
    function logLink(url, linkType, customData, callback, sourceElement) {

        var linkParams = linkType + '=' + encodeWrapper(purify(url));

        var interaction = getContentInteractionToRequestIfPossible(sourceElement, 'click', url);

        if (interaction) {
            linkParams += '&' + interaction;
        }

        var request = getRequest(linkParams, customData, 'link');

        sendRequest(request, (callback ? 0 : configTrackerPause), callback);
    }

    /*
     * Browser prefix
     */
    function prefixPropertyName(prefix, propertyName) {
        if (prefix !== '') {
            return prefix + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
        }

        return propertyName;
    }

    /*
     * Check for pre-rendered web pages, and log the page view/link/goal
     * according to the configuration and/or visibility
     *
     * @see http://dvcs.w3.org/hg/webperf/raw-file/tip/specs/PageVisibility/Overview.html
     */
    function trackCallback(callback) {
        var isPreRendered,
            i,
            // Chrome 13, IE10, FF10
            prefixes = ['', 'webkit', 'ms', 'moz'],
            prefix;

        if (!configCountPreRendered) {
            for (i = 0; i < prefixes.length; i++) {
                prefix = prefixes[i];

                // does this browser support the page visibility API?
                if (Object.prototype.hasOwnProperty.call(documentAlias, prefixPropertyName(prefix, 'hidden'))) {
                    // if pre-rendered, then defer callback until page visibility changes
                    if (documentAlias[prefixPropertyName(prefix, 'visibilityState')] === 'prerender') {
                        isPreRendered = true;
                    }
                    break;
                }
            }
        }

        if (isPreRendered) {
            // note: the event name doesn't follow the same naming convention as vendor properties
            addEventListener(documentAlias, prefix + 'visibilitychange', function ready() {
                documentAlias.removeEventListener(prefix + 'visibilitychange', ready, false);
                callback();
            });

            return;
        }

        // configCountPreRendered === true || isPreRendered === false
        callback();
    }

    function trackCallbackOnLoad(callback)
    {
        if (documentAlias.readyState === 'complete') {
            callback();
        } else if (windowAlias.addEventListener) {
            windowAlias.addEventListener('load', callback);
        } else if (windowAlias.attachEvent) {
            windowAlias.attachEvent('onLoad', callback);
        }
    }

    function trackCallbackOnReady(callback)
    {
        var loaded = false;

        if (documentAlias.attachEvent) {
            loaded = documentAlias.readyState === "complete";
        } else {
            loaded = documentAlias.readyState !== "loading";
        }

        if (loaded) {
            callback();
        } else if (documentAlias.addEventListener) {
            documentAlias.addEventListener('DOMContentLoaded', callback);
        } else if (documentAlias.attachEvent) {
            documentAlias.attachEvent('onreadystatechange', callback);
        }
    }

    /*
     * Process clicks
     */
    function processClick(sourceElement) {
        var link = getLinkIfShouldBeProcessed(sourceElement);

        if (link && link.type) {
            link.href = safeDecodeWrapper(link.href);
            logLink(link.href, link.type, undefined, null, sourceElement);
        }
    }

    function isIE8orOlder()
    {
        return documentAlias.all && !documentAlias.addEventListener;
    }

    function getKeyCodeFromEvent(event)
    {
        // event.which is deprecated https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/which
        var which = event.which;

        /**
         1 : Left mouse button
         2 : Wheel button or middle button
         3 : Right mouse button
         */

        var typeOfEventButton = (typeof event.button);

        if (!which && typeOfEventButton !== 'undefined' ) {
            /**
             -1: No button pressed
             0 : Main button pressed, usually the left button
             1 : Auxiliary button pressed, usually the wheel button or themiddle button (if present)
             2 : Secondary button pressed, usually the right button
             3 : Fourth button, typically the Browser Back button
             4 : Fifth button, typically the Browser Forward button

             IE8 and earlier has different values:
             1 : Left mouse button
             2 : Right mouse button
             4 : Wheel button or middle button

             For a left-hand configured mouse, the return values are reversed. We do not take care of that.
             */

            if (isIE8orOlder()) {
                if (event.button & 1) {
                    which = 1;
                } else if (event.button & 2) {
                    which = 3;
                } else if (event.button & 4) {
                    which = 2;
                }
            } else {
                if (event.button === 0 || event.button === '0') {
                    which = 1;
                } else if (event.button & 1) {
                    which = 2;
                } else if (event.button & 2) {
                    which = 3;
                }
            }
        }

        return which;
    }

    function getNameOfClickedButton(event)
    {
        switch (getKeyCodeFromEvent(event)) {
            case 1:
                return 'left';
            case 2:
                return 'middle';
            case 3:
                return 'right';
        }
    }

    function getTargetElementFromEvent(event)
    {
        return event.target || event.srcElement;
    }

    /*
     * Handle click event
     */
    function clickHandler(enable) {

        return function (event) {

            event = event || windowAlias.event;

            var button = getNameOfClickedButton(event);
            var target = getTargetElementFromEvent(event);

            if (event.type === 'click') {

                var ignoreClick = false;
                if (enable && button === 'middle') {
                    // if enabled, we track middle clicks via mouseup
                    // some browsers (eg chrome) trigger click and mousedown/up events when middle is clicked,
                    // whereas some do not. This way we make "sure" to track them only once, either in click
                    // (default) or in mouseup (if enable == true)
                    ignoreClick = true;
                }

                if (target && !ignoreClick) {
                    processClick(target);
                }
            } else if (event.type === 'mousedown') {
                if (button === 'middle' && target) {
                    lastButton = button;
                    lastTarget = target;
                } else {
                    lastButton = lastTarget = null;
                }
            } else if (event.type === 'mouseup') {
                if (button === lastButton && target === lastTarget) {
                    processClick(target);
                }
                lastButton = lastTarget = null;
            } else if (event.type === 'contextmenu') {
                processClick(target);
            }
        };
    }

    /*
     * Add click listener to a DOM element
     */
    function addClickListener(element, enable) {
        addEventListener(element, 'click', clickHandler(enable), false);

        if (enable) {
            addEventListener(element, 'mouseup', clickHandler(enable), false);
            addEventListener(element, 'mousedown', clickHandler(enable), false);
            addEventListener(element, 'contextmenu', clickHandler(enable), false);
        }
    }

    /*
     * Add click handlers to anchor and AREA elements, except those to be ignored
     */
    function addClickListeners(enable) {
        if (!linkTrackingInstalled) {
            linkTrackingInstalled = true;

            // iterate through anchor elements with href and AREA elements

            var i,
                ignorePattern = getClassesRegExp(configIgnoreClasses, 'ignore'),
                linkElements = documentAlias.links;

            if (linkElements) {
                for (i = 0; i < linkElements.length; i++) {
                    if (!ignorePattern.test(linkElements[i].className)) {
                        addClickListener(linkElements[i], enable);
                    }
                }
            }
        }
    }


    function enableTrackOnlyVisibleContent (checkOnSroll, timeIntervalInMs, tracker) {

        if (isTrackOnlyVisibleContentEnabled) {
            // already enabled, do not register intervals again
            return true;
        }

        isTrackOnlyVisibleContentEnabled = true;

        var didScroll = false;
        var events, index;

        function setDidScroll() { didScroll = true; }

        trackCallbackOnLoad(function () {

            function checkContent(intervalInMs) {
                setTimeout(function () {
                    if (!isTrackOnlyVisibleContentEnabled) {
                        return; // the tests stopped tracking only visible content
                    }
                    didScroll = false;
                    tracker.trackVisibleContentImpressions();
                    checkContent(intervalInMs);
                }, intervalInMs);
            }

            function checkContentIfDidScroll(intervalInMs) {

                setTimeout(function () {
                    if (!isTrackOnlyVisibleContentEnabled) {
                        return; // the tests stopped tracking only visible content
                    }

                    if (didScroll) {
                        didScroll = false;
                        tracker.trackVisibleContentImpressions();
                    }

                    checkContentIfDidScroll(intervalInMs);
                }, intervalInMs);
            }

            if (checkOnSroll) {

                // scroll event is executed after each pixel, so we make sure not to
                // execute event too often. otherwise FPS goes down a lot!
                events = ['scroll', 'resize'];
                for (index = 0; index < events.length; index++) {
                    if (documentAlias.addEventListener) {
                        documentAlias.addEventListener(events[index], setDidScroll);
                    } else {
                        windowAlias.attachEvent('on' + events[index], setDidScroll);
                    }
                }

                checkContentIfDidScroll(100);
            }

            if (timeIntervalInMs && timeIntervalInMs > 0) {
                timeIntervalInMs = parseInt(timeIntervalInMs, 10);
                checkContent(timeIntervalInMs);
            }

        });
    }

    /*
     * Browser features (plugins, resolution, cookies)
     */
    function detectBrowserFeatures() {
        var i,
            mimeType,
            pluginMap = {
                // document types
                pdf: 'application/pdf',

                // media players
                qt: 'video/quicktime',
                realp: 'audio/x-pn-realaudio-plugin',
                wma: 'application/x-mplayer2',

                // interactive multimedia
                dir: 'application/x-director',
                fla: 'application/x-shockwave-flash',

                // RIA
                java: 'application/x-java-vm',
                gears: 'application/x-googlegears',
                ag: 'application/x-silverlight'
            },
            devicePixelRatio = windowAlias.devicePixelRatio || 1;

        // detect browser features except IE < 11 (IE 11 user agent is no longer MSIE)
        if (!((new RegExp('MSIE')).test(navigatorAlias.userAgent))) {
            // general plugin detection
            if (navigatorAlias.mimeTypes && navigatorAlias.mimeTypes.length) {
                for (i in pluginMap) {
                    if (Object.prototype.hasOwnProperty.call(pluginMap, i)) {
                        mimeType = navigatorAlias.mimeTypes[pluginMap[i]];
                        browserFeatures[i] = (mimeType && mimeType.enabledPlugin) ? '1' : '0';
                    }
                }
            }

            // Safari and Opera
            // IE6/IE7 navigator.javaEnabled can't be aliased, so test directly
            if (typeof navigator.javaEnabled !== 'unknown' &&
                    isDefined(navigatorAlias.javaEnabled) &&
                    navigatorAlias.javaEnabled()) {
                browserFeatures.java = '1';
            }

            // Firefox
            if (isFunction(windowAlias.GearsFactory)) {
                browserFeatures.gears = '1';
            }

            // other browser features
            browserFeatures.cookie = hasCookies();
        }

        // screen resolution
        browserFeatures.res = screenAlias.width * devicePixelRatio + 'x' + screenAlias.height * devicePixelRatio;
    }

/*<DEBUG>*/
    /*
     * Register a test hook. Using eval() permits access to otherwise
     * privileged members.
     */
    function registerHook(hookName, userHook) {
        var hookObj = null;

        if (isString(hookName) && !isDefined(registeredHooks[hookName]) && userHook) {
            if (isObject(userHook)) {
                hookObj = userHook;
            } else if (isString(userHook)) {
                try {
                    eval('hookObj =' + userHook);
                } catch (ignore) { }
            }

            registeredHooks[hookName] = hookObj;
        }

        return hookObj;
    }
/*</DEBUG>*/

    /************************************************************
     * Constructor
     ************************************************************/

    /*
     * initialize tracker
     */
    detectBrowserFeatures();
    updateDomainHash();
    setVisitorIdCookie();

/*<DEBUG>*/
    /*
     * initialize test plugin
     */
    executePluginMethod('run', registerHook);
/*</DEBUG>*/

    /************************************************************
     * Public data and methods
     ************************************************************/

    return {
/*<DEBUG>*/
        /*
         * Test hook accessors
         */
        hook: registeredHooks,
        getHook: function (hookName) {
            return registeredHooks[hookName];
        },
        getQuery: function () {
            return query;
        },
        getContent: function () {
            return content;
        },

        buildContentImpressionRequest: buildContentImpressionRequest,
        buildContentInteractionRequest: buildContentInteractionRequest,
        buildContentInteractionRequestNode: buildContentInteractionRequestNode,
        buildContentInteractionTrackingRedirectUrl: buildContentInteractionTrackingRedirectUrl,
        getContentImpressionsRequestsFromNodes: getContentImpressionsRequestsFromNodes,
        getCurrentlyVisibleContentImpressionsRequestsIfNotTrackedYet: getCurrentlyVisibleContentImpressionsRequestsIfNotTrackedYet,
        trackCallbackOnLoad: trackCallbackOnLoad,
        trackCallbackOnReady: trackCallbackOnReady,
        buildContentImpressionsRequests: buildContentImpressionsRequests,
        wasContentImpressionAlreadyTracked: wasContentImpressionAlreadyTracked,
        appendContentInteractionToRequestIfPossible: getContentInteractionToRequestIfPossible,
        setupInteractionsTracking: setupInteractionsTracking,
        trackContentImpressionClickInteraction: trackContentImpressionClickInteraction,
        internalIsNodeVisible: isVisible,
        isNodeAuthorizedToTriggerInteraction: isNodeAuthorizedToTriggerInteraction,
        replaceHrefIfInternalLink: replaceHrefIfInternalLink,
        getConfigDownloadExtensions: function () {
            return configDownloadExtensions;
        },
        enableTrackOnlyVisibleContent: function (checkOnScroll, timeIntervalInMs) {
            return enableTrackOnlyVisibleContent(checkOnScroll, timeIntervalInMs, this);
        },
        clearTrackedContentImpressions: function () {
            trackedContentImpressions = [];
        },
        getTrackedContentImpressions: function () {
            return trackedContentImpressions;
        },
        clearEnableTrackOnlyVisibleContent: function () {
            isTrackOnlyVisibleContentEnabled = false;
        },
        disableLinkTracking: function () {
            linkTrackingInstalled = false;
            linkTrackingEnabled   = false;
        },
        getConfigVisitorCookieTimeout: function () {
            return configVisitorCookieTimeout;
        },
        getRemainingVisitorCookieTimeout: getRemainingVisitorCookieTimeout,
/*</DEBUG>*/

        /**
         * Get visitor ID (from first party cookie)
         *
         * @return string Visitor ID in hexits (or empty string, if not yet known)
         */
        getVisitorId: function () {
            return getValuesFromVisitorIdCookie().uuid;
        },

        /**
         * Get the visitor information (from first party cookie)
         *
         * @return array
         */
        getVisitorInfo: function () {
            // Note: in a new method, we could return also return getValuesFromVisitorIdCookie()
            //       which returns named parameters rather than returning integer indexed array
            return loadVisitorIdCookie();
        },

        /**
         * Get the Attribution information, which is an array that contains
         * the Referrer used to reach the site as well as the campaign name and keyword
         * It is useful only when used in conjunction with Tracker API function setAttributionInfo()
         * To access specific data point, you should use the other functions getAttributionReferrer* and getAttributionCampaign*
         *
         * @return array Attribution array, Example use:
         *   1) Call JSON2.stringify(piwikTracker.getAttributionInfo())
         *   2) Pass this json encoded string to the Tracking API (php or java client): setAttributionInfo()
         */
        getAttributionInfo: function () {
            return loadReferrerAttributionCookie();
        },

        /**
         * Get the Campaign name that was parsed from the landing page URL when the visitor
         * landed on the site originally
         *
         * @return string
         */
        getAttributionCampaignName: function () {
            return loadReferrerAttributionCookie()[0];
        },

        /**
         * Get the Campaign keyword that was parsed from the landing page URL when the visitor
         * landed on the site originally
         *
         * @return string
         */
        getAttributionCampaignKeyword: function () {
            return loadReferrerAttributionCookie()[1];
        },

        /**
         * Get the time at which the referrer (used for Goal Attribution) was detected
         *
         * @return int Timestamp or 0 if no referrer currently set
         */
        getAttributionReferrerTimestamp: function () {
            return loadReferrerAttributionCookie()[2];
        },

        /**
         * Get the full referrer URL that will be used for Goal Attribution
         *
         * @return string Raw URL, or empty string '' if no referrer currently set
         */
        getAttributionReferrerUrl: function () {
            return loadReferrerAttributionCookie()[3];
        },

        /**
         * Specify the Piwik server URL
         *
         * @param string trackerUrl
         */
        setTrackerUrl: function (trackerUrl) {
            configTrackerUrl = trackerUrl;
        },


        /**
         * Returns the Piwik server URL
         * @returns string
         */
        getTrackerUrl: function () {
            return configTrackerUrl;
        },


        /**
         * Returns the site ID
         *
         * @returns int
         */
        getSiteId: function() {
            return configTrackerSiteId;
        },

        /**
         * Specify the site ID
         *
         * @param int|string siteId
         */
        setSiteId: function (siteId) {
            setSiteId(siteId);
        },

        /**
         * Sets a User ID to this user (such as an email address or a username)
         *
         * @param string User ID
         */
        setUserId: function (userId) {
            if(!isDefined(userId) || !userId.length) {
                return;
            }
            configUserId = userId;
            visitorUUID = hash(configUserId).substr(0, 16);
        },

        /**
         * Gets the User ID if set.
         *
         * @returns string User ID
         */
        getUserId: function() {
            return configUserId;
        },

        /**
         * Pass custom data to the server
         *
         * Examples:
         *   tracker.setCustomData(object);
         *   tracker.setCustomData(key, value);
         *
         * @param mixed key_or_obj
         * @param mixed opt_value
         */
        setCustomData: function (key_or_obj, opt_value) {
            if (isObject(key_or_obj)) {
                configCustomData = key_or_obj;
            } else {
                if (!configCustomData) {
                    configCustomData = {};
                }
                configCustomData[key_or_obj] = opt_value;
            }
        },

        /**
         * Get custom data
         *
         * @return mixed
         */
        getCustomData: function () {
            return configCustomData;
        },

        /**
         * Configure function with custom request content processing logic.
         * It gets called after request content in form of query parameters string has been prepared and before request content gets sent.
         *
         * Examples:
         *   tracker.setCustomRequestProcessing(function(request){
         *     var pairs = request.split('&');
         *     var result = {};
         *     pairs.forEach(function(pair) {
         *       pair = pair.split('=');
         *       result[pair[0]] = decodeURIComponent(pair[1] || '');
         *     });
         *     return JSON.stringify(result);
         *   });
         *
         * @param function customRequestContentProcessingLogic
         */
        setCustomRequestProcessing: function (customRequestContentProcessingLogic) {
            configCustomRequestContentProcessing = customRequestContentProcessingLogic;
        },

        /**
         * Appends the specified query string to the piwik.php?... Tracking API URL
         *
         * @param string queryString eg. 'lat=140&long=100'
         */
        appendToTrackingUrl: function (queryString) {
            configAppendToTrackingUrl = queryString;
        },

        /**
         * Returns the query string for the current HTTP Tracking API request.
         * Piwik would prepend the hostname and path to Piwik: http://example.org/piwik/piwik.php?
         * prior to sending the request.
         *
         * @param request eg. "param=value&param2=value2"
         */
        getRequest: function (request) {
            return getRequest(request);
        },

        /**
         * Add plugin defined by a name and a callback function.
         * The callback function will be called whenever a tracking request is sent.
         * This can be used to append data to the tracking request, or execute other custom logic.
         *
         * @param string pluginName
         * @param Object pluginObj
         */
        addPlugin: function (pluginName, pluginObj) {
            plugins[pluginName] = pluginObj;
        },

        /**
         * Set custom variable within this visit
         *
         * @param int index Custom variable slot ID from 1-5
         * @param string name
         * @param string value
         * @param string scope Scope of Custom Variable:
         *                     - "visit" will store the name/value in the visit and will persist it in the cookie for the duration of the visit,
         *                     - "page" will store the name/value in the next page view tracked.
         *                     - "event" will store the name/value in the next event tracked.
         */
        setCustomVariable: function (index, name, value, scope) {
            var toRecord;

            if (!isDefined(scope)) {
                scope = 'visit';
            }
            if (!isDefined(name)) {
                return;
            }
            if (!isDefined(value)) {
                value = "";
            }
            if (index > 0) {
                name = !isString(name) ? String(name) : name;
                value = !isString(value) ? String(value) : value;
                toRecord = [name.slice(0, customVariableMaximumLength), value.slice(0, customVariableMaximumLength)];
                // numeric scope is there for GA compatibility
                if (scope === 'visit' || scope === 2) {
                    loadCustomVariables();
                    customVariables[index] = toRecord;
                } else if (scope === 'page' || scope === 3) {
                    customVariablesPage[index] = toRecord;
                } else if (scope === 'event') { /* GA does not have 'event' scope but we do */
                    customVariablesEvent[index] = toRecord;
                }
            }
        },

        /**
         * Get custom variable
         *
         * @param int index Custom variable slot ID from 1-5
         * @param string scope Scope of Custom Variable: "visit" or "page" or "event"
         */
        getCustomVariable: function (index, scope) {
            var cvar;

            if (!isDefined(scope)) {
                scope = "visit";
            }

            if (scope === "page" || scope === 3) {
                cvar = customVariablesPage[index];
            } else if (scope === "event") {
                cvar = customVariablesEvent[index];
            } else if (scope === "visit" || scope === 2) {
                loadCustomVariables();
                cvar = customVariables[index];
            }

            if (!isDefined(cvar)
                    || (cvar && cvar[0] === '')) {
                return false;
            }

            return cvar;
        },

        /**
         * Delete custom variable
         *
         * @param int index Custom variable slot ID from 1-5
         */
        deleteCustomVariable: function (index, scope) {
            // Only delete if it was there already
            if (this.getCustomVariable(index, scope)) {
                this.setCustomVariable(index, '', '', scope);
            }
        },

        /**
         * When called then the Custom Variables of scope "visit" will be stored (persisted) in a first party cookie
         * for the duration of the visit. This is useful if you want to call getCustomVariable later in the visit.
         *
         * By default, Custom Variables of scope "visit" are not stored on the visitor's computer.
         */
        storeCustomVariablesInCookie: function () {
            configStoreCustomVariablesInCookie = true;
        },

        /**
         * Set delay for link tracking (in milliseconds)
         *
         * @param int delay
         */
        setLinkTrackingTimer: function (delay) {
            configTrackerPause = delay;
        },

        /**
         * Set list of file extensions to be recognized as downloads
         *
         * @param string|array extensions
         */
        setDownloadExtensions: function (extensions) {
            if(isString(extensions)) {
                extensions = extensions.split('|');
            }
            configDownloadExtensions = extensions;
        },

        /**
         * Specify additional file extensions to be recognized as downloads
         *
         * @param string|array extensions  for example 'custom' or ['custom1','custom2','custom3']
         */
        addDownloadExtensions: function (extensions) {
            var i;
            if(isString(extensions)) {
                extensions = extensions.split('|');
            }
            for (i=0; i < extensions.length; i++) {
                configDownloadExtensions.push(extensions[i]);
            }
        },

        /**
         * Removes specified file extensions from the list of recognized downloads
         *
         * @param string|array extensions  for example 'custom' or ['custom1','custom2','custom3']
         */
        removeDownloadExtensions: function (extensions) {
            var i, newExtensions = [];
            if(isString(extensions)) {
                extensions = extensions.split('|');
            }
            for (i=0; i < configDownloadExtensions.length; i++) {
                if (indexOfArray(extensions, configDownloadExtensions[i]) === -1) {
                    newExtensions.push(configDownloadExtensions[i]);
                }
            }
            configDownloadExtensions = newExtensions;
        },

        /**
         * Set array of domains to be treated as local
         *
         * @param string|array hostsAlias
         */
        setDomains: function (hostsAlias) {
            configHostsAlias = isString(hostsAlias) ? [hostsAlias] : hostsAlias;
            configHostsAlias.push(domainAlias);
        },

        /**
         * Set array of classes to be ignored if present in link
         *
         * @param string|array ignoreClasses
         */
        setIgnoreClasses: function (ignoreClasses) {
            configIgnoreClasses = isString(ignoreClasses) ? [ignoreClasses] : ignoreClasses;
        },

        /**
         * Set request method
         *
         * @param string method GET or POST; default is GET
         */
        setRequestMethod: function (method) {
            configRequestMethod = method || defaultRequestMethod;
        },

        /**
         * Set request Content-Type header value, applicable when POST request method is used for submitting tracking events.
         * See XMLHttpRequest Level 2 spec, section 4.7.2 for invalid headers
         * @link http://dvcs.w3.org/hg/xhr/raw-file/tip/Overview.html
         *
         * @param string requestContentType; default is 'application/x-www-form-urlencoded; charset=UTF-8'
         */
        setRequestContentType: function (requestContentType) {
            configRequestContentType = requestContentType || defaultRequestContentType;
        },

        /**
         * Override referrer
         *
         * @param string url
         */
        setReferrerUrl: function (url) {
            configReferrerUrl = url;
        },

        /**
         * Override url
         *
         * @param string url
         */
        setCustomUrl: function (url) {
            configCustomUrl = resolveRelativeReference(locationHrefAlias, url);
        },

        /**
         * Override document.title
         *
         * @param string title
         */
        setDocumentTitle: function (title) {
            configTitle = title;
        },

        /**
         * Set the URL of the Piwik API. It is used for Page Overlay.
         * This method should only be called when the API URL differs from the tracker URL.
         *
         * @param string apiUrl
         */
        setAPIUrl: function (apiUrl) {
            configApiUrl = apiUrl;
        },

        /**
         * Set array of classes to be treated as downloads
         *
         * @param string|array downloadClasses
         */
        setDownloadClasses: function (downloadClasses) {
            configDownloadClasses = isString(downloadClasses) ? [downloadClasses] : downloadClasses;
        },

        /**
         * Set array of classes to be treated as outlinks
         *
         * @param string|array linkClasses
         */
        setLinkClasses: function (linkClasses) {
            configLinkClasses = isString(linkClasses) ? [linkClasses] : linkClasses;
        },

        /**
         * Set array of campaign name parameters
         *
         * @see http://piwik.org/faq/how-to/#faq_120
         * @param string|array campaignNames
         */
        setCampaignNameKey: function (campaignNames) {
            configCampaignNameParameters = isString(campaignNames) ? [campaignNames] : campaignNames;
        },

        /**
         * Set array of campaign keyword parameters
         *
         * @see http://piwik.org/faq/how-to/#faq_120
         * @param string|array campaignKeywords
         */
        setCampaignKeywordKey: function (campaignKeywords) {
            configCampaignKeywordParameters = isString(campaignKeywords) ? [campaignKeywords] : campaignKeywords;
        },

        /**
         * Strip hash tag (or anchor) from URL
         * Note: this can be done in the Piwik>Settings>Websites on a per-website basis
         *
         * @deprecated
         * @param bool enableFilter
         */
        discardHashTag: function (enableFilter) {
            configDiscardHashTag = enableFilter;
        },

        /**
         * Set first-party cookie name prefix
         *
         * @param string cookieNamePrefix
         */
        setCookieNamePrefix: function (cookieNamePrefix) {
            configCookieNamePrefix = cookieNamePrefix;
            // Re-init the Custom Variables cookie
            customVariables = getCustomVariablesFromCookie();
        },

        /**
         * Set first-party cookie domain
         *
         * @param string domain
         */
        setCookieDomain: function (domain) {
            var domainFixed = domainFixup(domain);

            if (isPossibleToSetCookieOnDomain(domainFixed)) {
                configCookieDomain = domainFixed;
                updateDomainHash();
            }
        },

        /**
         * Set first-party cookie path
         *
         * @param string domain
         */
        setCookiePath: function (path) {
            configCookiePath = path;
            updateDomainHash();
        },

        /**
         * Set visitor cookie timeout (in seconds)
         * Defaults to 13 months (timeout=33955200)
         *
         * @param int timeout
         */
        setVisitorCookieTimeout: function (timeout) {
            configVisitorCookieTimeout = timeout * 1000;
        },

        /**
         * Set session cookie timeout (in seconds).
         * Defaults to 30 minutes (timeout=1800000)
         *
         * @param int timeout
         */
        setSessionCookieTimeout: function (timeout) {
            configSessionCookieTimeout = timeout * 1000;
        },

        /**
         * Set referral cookie timeout (in seconds).
         * Defaults to 6 months (15768000000)
         *
         * @param int timeout
         */
        setReferralCookieTimeout: function (timeout) {
            configReferralCookieTimeout = timeout * 1000;
        },

        /**
         * Set conversion attribution to first referrer and campaign
         *
         * @param bool if true, use first referrer (and first campaign)
         *             if false, use the last referrer (or campaign)
         */
        setConversionAttributionFirstReferrer: function (enable) {
            configConversionAttributionFirstReferrer = enable;
        },

        /**
         * Disables all cookies from being set
         *
         * Existing cookies will be deleted on the next call to track
         */
        disableCookies: function () {
            configCookiesDisabled = true;
            browserFeatures.cookie = '0';

            if (configTrackerSiteId) {
                deleteCookies();
            }
        },

        /**
         * One off cookies clearing. Useful to call this when you know for sure a new visitor is using the same browser,
         * it maybe helps to "reset" tracking cookies to prevent data reuse for different users.
         */
        deleteCookies: function () {
            deleteCookies();
        },

        /**
         * Handle do-not-track requests
         *
         * @param bool enable If true, don't track if user agent sends 'do-not-track' header
         */
        setDoNotTrack: function (enable) {
            var dnt = navigatorAlias.doNotTrack || navigatorAlias.msDoNotTrack;
            configDoNotTrack = enable && (dnt === 'yes' || dnt === '1');

            // do not track also disables cookies and deletes existing cookies
            if (configDoNotTrack) {
                this.disableCookies();
            }
        },

        /**
         * Add click listener to a specific link element.
         * When clicked, Piwik will log the click automatically.
         *
         * @param DOMElement element
         * @param bool enable If true, use pseudo click-handler (middle click + context menu)
         */
        addListener: function (element, enable) {
            addClickListener(element, enable);
        },

        /**
         * Install link tracker
         *
         * The default behaviour is to use actual click events. However, some browsers
         * (e.g., Firefox, Opera, and Konqueror) don't generate click events for the middle mouse button.
         *
         * To capture more "clicks", the pseudo click-handler uses mousedown + mouseup events.
         * This is not industry standard and is vulnerable to false positives (e.g., drag events).
         *
         * There is a Safari/Chrome/Webkit bug that prevents tracking requests from being sent
         * by either click handler.  The workaround is to set a target attribute (which can't
         * be "_self", "_top", or "_parent").
         *
         * @see https://bugs.webkit.org/show_bug.cgi?id=54783
         *
         * @param bool enable If "true", use pseudo click-handler (treat middle click and open contextmenu as
         *                    left click). A right click (or any click that opens the context menu) on a link
         *                    will be tracked as clicked even if "Open in new tab" is not selected. If
         *                    "false" (default), nothing will be tracked on open context menu or middle click.
         *                    The context menu is usually opened to open a link / download in a new tab
         *                    therefore you can get more accurate results by treat it as a click but it can lead
         *                    to wrong click numbers.
         */
        enableLinkTracking: function (enable) {
            linkTrackingEnabled = true;

            if (hasLoaded) {
                // the load event has already fired, add the click listeners now
                addClickListeners(enable);
            } else {
                // defer until page has loaded
                registeredOnLoadHandlers.push(function () {
                    addClickListeners(enable);
                });
            }
        },

        /**
         * Enable tracking of uncatched JavaScript errors
         *
         * If enabled, uncaught JavaScript Errors will be tracked as an event by defining a
         * window.onerror handler. If a window.onerror handler is already defined we will make
         * sure to call this previously registered error handler after tracking the error.
         *
         * By default we return false in the window.onerror handler to make sure the error still
         * appears in the browser's console etc. Note: Some older browsers might behave differently
         * so it could happen that an actual JavaScript error will be suppressed.
         * If a window.onerror handler was registered we will return the result of this handler.
         *
         * Make sure not to overwrite the window.onerror handler after enabling the JS error
         * tracking as the error tracking won't work otherwise. To capture all JS errors we
         * recommend to include the Piwik JavaScript tracker in the HTML as early as possible.
         * If possible directly in <head></head> before loading any other JavaScript.
         */
        enableJSErrorTracking: function () {
            if (enableJSErrorTracking) {
                return;
            }

            enableJSErrorTracking = true;
            var onError = windowAlias.onerror;

            windowAlias.onerror = function (message, url, linenumber, column, error) {
                trackCallback(function () {
                    var category = 'JavaScript Errors';

                    var action = url + ':' + linenumber;
                    if (column) {
                        action += ':' + column;
                    }

                    logEvent(category, action, message);
                });

                if (onError) {
                    return onError(message, url, linenumber, column, error);
                }

                return false;
            };
        },

        /**
         * Disable automatic performance tracking
         */
        disablePerformanceTracking: function () {
            configPerformanceTrackingEnabled = false;
        },

        /**
         * Set the server generation time.
         * If set, the browser's performance.timing API in not used anymore to determine the time.
         *
         * @param int generationTime
         */
        setGenerationTimeMs: function (generationTime) {
            configPerformanceGenerationTime = parseInt(generationTime, 10);
        },

        /**
         * Set heartbeat (in seconds)
         *
         * @param int heartBeatDelayInSeconds Defaults to 15. Cannot be lower than 1.
         */
        enableHeartBeatTimer: function (heartBeatDelayInSeconds) {
            heartBeatDelayInSeconds = Math.max(heartBeatDelayInSeconds, 1);
            configHeartBeatDelay = (heartBeatDelayInSeconds || 15) * 1000;

            // if a tracking request has already been sent, start the heart beat timeout
            if (lastTrackerRequestTime !== null) {
                setUpHeartBeat();
            }
        },

/*<DEBUG>*/
        /**
         * Clear heartbeat.
         */
        disableHeartBeatTimer: function () {
            heartBeatDown();
            configHeartBeatDelay = null;

            window.removeEventListener('focus', heartBeatOnFocus);
            window.removeEventListener('blur', heartBeatOnBlur);
        },
/*</DEBUG>*/

        /**
         * Frame buster
         */
        killFrame: function () {
            if (windowAlias.location !== windowAlias.top.location) {
                windowAlias.top.location = windowAlias.location;
            }
        },

        /**
         * Redirect if browsing offline (aka file: buster)
         *
         * @param string url Redirect to this URL
         */
        redirectFile: function (url) {
            if (windowAlias.location.protocol === 'file:') {
                windowAlias.location = url;
            }
        },

        /**
         * Count sites in pre-rendered state
         *
         * @param bool enable If true, track when in pre-rendered state
         */
        setCountPreRendered: function (enable) {
            configCountPreRendered = enable;
        },

        /**
         * Trigger a goal
         *
         * @param int|string idGoal
         * @param int|float customRevenue
         * @param mixed customData
         */
        trackGoal: function (idGoal, customRevenue, customData) {
            trackCallback(function () {
                logGoal(idGoal, customRevenue, customData);
            });
        },


    };
}

module.exports = Tracker;