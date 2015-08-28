/************************************************************
* Deprecated functionality below
* Legacy piwik.js compatibility ftw
************************************************************/

/*
* Piwik globals
*
*   var piwik_install_tracker, piwik_tracker_pause, piwik_download_extensions, piwik_hosts_alias, piwik_ignore_classes;
*/
/*global piwik_log:true */
/*global piwik_track:true */

/**
* Track page visit
*
* @param string documentTitle
* @param int|string siteId
* @param string piwikUrl
* @param mixed customData
*/
function piwik_log(documentTitle, siteId, piwikUrl, customData) {
    'use strict';

    function getOption(optionName) {
        try {
            return eval('piwik_' + optionName);
        } catch (ignore) { }

        return; // undefined
    }

    // instantiate the tracker
    var option,
        piwikTracker = Piwik.getTracker(piwikUrl, siteId);

    // initialize tracker
    piwikTracker.setDocumentTitle(documentTitle);
    piwikTracker.setCustomData(customData);

    // handle Piwik globals
    option = getOption('tracker_pause');

    if (option) {
        piwikTracker.setLinkTrackingTimer(option);
    }

    option = getOption('download_extensions');

    if (option) {
        piwikTracker.setDownloadExtensions(option);
    }

    option = getOption('hosts_alias');

    if (option) {
        piwikTracker.setDomains(option);
    }

    option = getOption('ignore_classes');

    if (option) {
        piwikTracker.setIgnoreClasses(option);
    }

    // track this page view
    piwikTracker.trackPageView();

    // default is to install the link tracker
    if (getOption('install_tracker')) {

        /**
         * Track click manually (function is defined below)
         *
         * @param string sourceUrl
         * @param int|string siteId
         * @param string piwikUrl
         * @param string linkType
         */
        piwik_track = function (sourceUrl, siteId, piwikUrl, linkType) {
            piwikTracker.setSiteId(siteId);
            piwikTracker.setTrackerUrl(piwikUrl);
            piwikTracker.trackLink(sourceUrl, linkType);
        };

        // set-up link tracking
        piwikTracker.enableLinkTracking();
    }
}

module.exports = piwik_log;
