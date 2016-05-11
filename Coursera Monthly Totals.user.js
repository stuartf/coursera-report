// ==UserScript==
// @name         Coursera Monthly Totals
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Summarize some monthly totals on the coursera dashboard
// @author       D. Stuart Freeman
// @match        https://www.coursera.org/teach-partner/*/monitor
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @require      http://underscorejs.org/underscore-min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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

                    // We need to know the month and year for the previous 2 months
                    var now = new Date();
                    var lastMonth = new Date();
                    lastMonth.setMonth(lastMonth.getMonth() - 1);
                    var twoMonthsAgo = new Date();
                    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

                    var thisMonthEnrollments = getLast(enrollments, now).running_enrollments - getLast(enrollments, lastMonth).running_enrollments;
                    var lastMonthEnrollments = getLast(enrollments, lastMonth).running_enrollments - getLast(enrollments, twoMonthsAgo).running_enrollments;

                    var thisMonthActive = getLast(active, now).running_active_enrollments - getLast(active, lastMonth).running_active_enrollments;
                    var lastMonthActive = getLast(active, lastMonth).running_active_enrollments - getLast(active, twoMonthsAgo).running_active_enrollments;

                    var thisMonthFinaid = getLast(finaid, now).running_finaid_enrollments - getLast(finaid, lastMonth).running_finaid_enrollments;
                    var lastMonthFinaid = getLast(finaid, lastMonth).running_finaid_enrollments - getLast(finaid, twoMonthsAgo).running_finaid_enrollments;

                    var target = 'div.navigation-body > div';

                    var render = function() {
                        var template = _.template('<div class="horizontal-box" style="padding-top: 1em;"><table>\
                                <tr><th></th><th style="padding: 0 1em 0 1em;">Prev Month</th><th>This Month</th></tr>\
                                <tr><td>Enrollments</td><td align="right" style="padding: 0 1em 0 1em;"><%=lastMo.en%></td><td align="right"><%=thisMo.en%></td></tr>\
                                <tr><td>Active Enrollments</td><td align="right" style="padding: 0 1em 0 1em;"><%=lastMo.ac%></td><td align="right"><%=thisMo.ac%></td></tr>\
                                <tr><td>Financial Aid</td><td align="right" style="padding: 0 1em 0 1em;"><%=lastMo.fa%></td><td align="right"><%=thisMo.fa%></td></tr>\
                            </table></div>'
                                                 );
                        $(target).append(template({
                            'lastMo':{
                                'en': lastMonthEnrollments,
                                'ac': lastMonthActive,
                                'fa': lastMonthFinaid
                            },
                            'thisMo':{
                                'en': thisMonthEnrollments,
                                'ac': thisMonthActive,
                                'fa': thisMonthFinaid
                            }
                        }));
                    };
                    waitForKeyElements(target, render);
                }
            });
        }});
})();