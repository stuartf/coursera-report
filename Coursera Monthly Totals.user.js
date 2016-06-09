// ==UserScript==
// @name         Coursera Monthly Totals
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Summarize some monthly totals on the coursera dashboard
// @author       D. Stuart Freeman
// @match        https://www.coursera.org/teach-partner/*/monitor
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @require      http://underscorejs.org/underscore-min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require      https://cdn.datatables.net/1.10.12/js/jquery.dataTables.min.js
// @resource dtcss https://cdn.datatables.net/1.10.12/css/jquery.dataTables.min.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

(function() {
    'use strict';

    // add the datatables css to the page
    GM_addStyle(GM_getResourceText('dtcss'));

    // gets the body of the Object with the matching name from the coursera batch request result
    var unpack = function(data, name) {
        return data.elements[_.findIndex(data.elements, function(element){return element.name === name;})].body;
    };

    // formats a date like YYYY-MM
    var yearAndMonth = function(date) {
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        // 0 pad the date so it's always 2 chars
        month = ('0' + month).substr(-2,2);
        return year + '-' + month;
    };

    // gets the last entry for a month
    var getLast = function(list, date) {
        date = yearAndMonth(date);
        var init = {'date': date + '-00'};
        return _.reduce(list, function(memo, entry) {
            // is this entry from the year-month we're looking for and is it's day higher than any we've seen
            if (entry.date.substr(0,7) === date && parseInt(entry.date.substr(-2, 2), 10) > parseInt(memo.date.substr(-2,2))) {
                return entry;
            }
            return memo;
        }, init);
    };

    var shortName = window.location.href.split('/')[4];
    $.ajax({
        'url': 'https://www.coursera.org/api/partners.v1?q=shortName&shortName=' + shortName,
        'dataType': 'JSON',
        'success': function(data) {
            var partnerId = data.elements[0].id;

            $.ajax({
                'url': 'https://www.coursera.org/api/reports.v1?ids=Partner~' + partnerId + '~partner_dashboard_course_enrollments,Partner~' + partnerId + '~partner_dashboard_active_enrollments,Partner~' + partnerId + '~partner_dashboard_finaid_enrollments',
                'dataType': 'JSON',
                'success': function(data) {
                    var enrollments = unpack(data, 'partner_dashboard_course_enrollments');
                    var active = unpack(data, 'partner_dashboard_active_enrollments');
                    var finaid = unpack(data, 'partner_dashboard_finaid_enrollments');

                    // gets the enrollments, active enrollments, and finaid for a given month
                    var getMonth = function(date) {
                        var prevdate = new Date(date);
                        prevdate.setMonth(date.getMonth() - 1);
                        return {
                            'enrollments': getLast(enrollments, date).running_enrollments - getLast(enrollments, prevdate).running_enrollments,
                            'active': getLast(active, date).running_active_enrollments - getLast(active, prevdate).running_active_enrollments,
                            'finaid': getLast(finaid, date).running_finaid_enrollments - getLast(finaid, prevdate).running_finaid_enrollments
                        };
                    };

                    // We need to know the month and year for the previous month
                    var now = new Date();
                    var lastMonth = new Date();
                    lastMonth.setMonth(lastMonth.getMonth() - 1);

                    var thisMonthData = getMonth(now);
                    var lastMonthData = getMonth(lastMonth);

                    var target = 'div.navigation-body > div';

                    var render = function() {
                        var table ='<div class="horizontal-box" style="padding-top: 1em;"><table id="tmMonthlyTotals"><thead><tr><th></th><th>Prev Month</th><th>This Month</th></tr></thead><tbody></tbody></table></div>';

                        $(target).append(table);

                        $('#tmMonthlyTotals').DataTable({'paging': false, 'searching': false, 'info': false, 'order': [1, 'desc'], 'columnDefs': [{'className': 'dt-right', 'targets': [1, 2]}], 'data': [
                            ['Enrollments', lastMonthData.enrollments, thisMonthData.enrollments],
                            ['Active Enrollments', lastMonthData.active, thisMonthData.active],
                            ['Financial Aid', lastMonthData.finaid, thisMonthData.finaid]
                        ]});
                    };
                    waitForKeyElements(target, render);
                }
            });
        }});
})();
