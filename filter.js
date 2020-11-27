// ==UserScript==
// @name         FUT 21 Filters with TamperMonkey
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @updateURL    https://github.com/chithakumar13/Fifa-AutoBuyer/blob/master/autobuyer.js
// @description  FUT Snipping Tool
// @author       CK Algos
// @match        https://www.ea.com/*/fifa/ultimate-team/web-app/*
// @match        https://www.ea.com/fifa/ultimate-team/web-app/* 
// ==/UserScript==

(function () {
    'use strict';

    window.UTSearchEnhancerViewController = function () {
        UTMarketSearchResultsViewController.call(this);
        this._jsClassName = "UTSearchEnhancerViewController";
    };    

    utils.JS.inherits(UTSearchEnhancerViewController, UTMarketSearchResultsViewController);

    var db = openDatabase('filter', '1.0', 'FIFA Filter DB', 2 * 1024 * 1024);  

    db.transaction(function (tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS PlayerId (id, nationid,leagueid,teamid)');
        tx.executeSql('CREATE TABLE IF NOT EXISTS CurrentRating (rating)'); 
    });
     
    window.currentRating = ""; 

    db.transaction(function (tx) { 
        tx.executeSql('SELECT * FROM CurrentRating', [], function (tx, ratingResults) {
            if (ratingResults.rows.length) {
                window.currentRating = ratingResults.rows[0].rating || ""; 
            }
        }, null); 
    });

    window.getRandNumber = function (min, max) {
        return Math.round((Math.random() * (max - min) + min));
    };

    UTItemService.prototype.searchTransferMarket = function searchTransferMarket(searchCriteria, pageNum, fromRequestItem, observable) {
        var result = observable || new EAObservable();
        if (!fromRequestItem && pageNum === 1) {
            this.updateCriteria(searchCriteria, pageNum, result);
            return result;
        }
        var response = new UTServiceResponseDTO();
        function successSearch(param1, successResult) {
            param1.unobserve(this);
            response.success = successResult.success;
            response.status = successResult.status;
            response.data = {};
            response.data.items = successResult.response.items;
            if (successResult.success && successResult.response.items.length > 0) {
                this._marketRepository.setPageCache(pageNum, successResult.response.items, Date.now(), successResult.maxAge > 0 ? successResult.maxAge : null);
            }
            result.notify(response);
        }
        function refreshSuccess(currRefresh, refreshResult) {
            currRefresh.unobserve(this);
            response.success = !![];
            response.status = refreshResult.success ? HttpStatusCode['OK'] : HttpStatusCode.NOT_MODIFIED;
            response.data = {};
            response.data.items = this._marketRepository.getPageCache(pageNum);
            result.notify(response);
        }
        if (!this._marketRepository.isCacheExpired(pageNum)) {
            var currPageCache = this._marketRepository.getPageCache(pageNum);
            if (currPageCache.length > 0) {
                this.refreshAuctions(currPageCache).observe(this, refreshSuccess);
            } else {
                response.success = !![];
                response.status = HttpStatusCode.NOT_MODIFIED;
                response.data = {};
                response.data.items = currPageCache;
                result.notify(response);
            }
        } else {
            var currConfigObj = gConfigurationModel.getConfigObject(models.ConfigurationModel.KEY_ITEMS_PER_PAGE);
            var currItemCount = utils.JS.isValid(currConfigObj) ? currConfigObj[models.ConfigurationModel.ITEMS_PER_PAGE.TRANSFER_MARKET] : 20;
            searchCriteria.offset = currItemCount * (pageNum - 1);
            searchCriteria.count = currItemCount + 1;
            accessobjects.Item.searchTransferMarket(searchCriteria).observe(this, successSearch);
        }
        return result;
    }

    UTItemService.prototype.updateCriteria = function updateCriteria(searchCriteria, l, result) {
        db.transaction(function (tx) {
            tx.executeSql(`SELECT id FROM PlayerId WHERE (${searchCriteria.nation} IS -1 OR nationid = ${searchCriteria.nation}) AND
                                                             (${searchCriteria.league} IS -1 OR leagueid = ${searchCriteria.league}) AND
                                                             (${searchCriteria.club} IS -1 OR teamid = ${searchCriteria.club})`,
                [], function (tx, results) {
                    let playerIds = [];
                    for (let i = 0; i < results.rows.length; i++) {
                        playerIds.push(results.rows[i].id);
                    }

                    if (playerIds.length) {
                        searchCriteria.maskedDefId = playerIds[getRandNumber(0, playerIds.length - 1)];
                    }

                    if (window.currentRating && !searchCriteria.maskedDefId) {
                        searchCriteria.maskedDefId = 1;
                    }
                    this.searchTransferMarket(searchCriteria, l, true, result);
                }.bind(this))
        }.bind(this));
    };     

    UTMarketSearchResultsViewController.prototype._searchFut = function (l) { 

        this._paginationViewModel.stopAuctionUpdates(),
            services.Item.searchTransferMarket(this._searchCriteria, l,true).observe(this, function _onRequestItemsComplete(e, t) {                 
                if (e.unobserve(this),
                    !t.success)
                    return NetworkErrorManager.checkCriticalStatus(t.status) ? void NetworkErrorManager.handleStatus(t.status) : (services.Notification.queue([services.Localization.localize("popup.error.searcherror"), enums.UINotificationType.NEGATIVE]),
                        void con.getNavigationController().popViewController());
                if (0 < this._searchCriteria.offset && 0 === t.data.items.length)
                    this._requestItems(l - 1);
                else {
                    var i = this._paginationViewModel.getNumItemsPerPage();
                    var o = t.data.items.slice();

                    if (this.onDataChange.notify({
                        items: o
                    }),
                        o.length > i && (o = o.slice(0, i)),
                        this._paginationViewModel.setPageItems(o),
                        this._paginationViewModel.setPageIndex(l),
                        this._selectedItem && 0 < o.length) {
                        var n = this._paginationViewModel.getIndexByItemId(this._selectedItem.id);
                        0 < n && this._paginationViewModel.setIndex(n),
                            this._selectedItem = null
                    }
                    var s = this.getView()
                        , a = null;
                    if (!this._stadiumViewmodel || this._searchCriteria.type !== SearchType.VANITY && this._searchCriteria.type !== SearchType.CLUB_INFO && this._searchCriteria.type !== SearchType.BALL || (a = this._stadiumViewmodel.getStadiumProgression(this._searchCriteria.subtypes)),
                        s.setItems(this._paginationViewModel.getCurrentPageItems(), a),
                        s.setPaginationState(1 < l, t.data.items.length > i),
                        utils.JS.isValid(this._compareItem) && !this._squadContext) {
                        var r = utils.JS.find(o, function (e) {
                            return e.getAuctionData().tradeId === this._compareItem.getAuctionData().tradeId
                        }
                            .bind(this));
                        utils.JS.isValid(r) ? this._pinnedListItem.setItem(r) : this._paginationViewModel.setPinnedItem(this._compareItem)
                    } else
                        !isPhone() && 0 < o.length && s.selectListRow(this._paginationViewModel.getCurrentItem().id)
                }
                this._paginationViewModel.startAuctionUpdates()
            });
    }  

    window.UTSnipeFilterViewController = function () {
        UTAppSettingsViewController.call(this);
        this._jsClassName = 'UTSnipeFilterViewController';
    };

    utils.JS.inherits(UTSnipeFilterViewController, UTAppSettingsViewController); 

    window.snipeFilterInterface = function () {
        if (services.Localization && jQuery('h1.title').html() === services.Localization.localize("navbar.label.home")) {
            window.hasLoadedAll = true;
        }

        if (window.hasLoadedAll && jQuery(".ut-app-settings-actions").length) {           
            if (jQuery(".ut-app-settings-actions").first().length) {
                if (!jQuery('#snipe_rating_filter').length) { 
                    jQuery(".ut-app-settings-actions").first().append(`<div class="ut-item-search-view">
                           <div class="search-price-header">
                                <h1>Snipe Settings:</h1>
                            </div>
                            <br/ >
                            <div style="width:100%" class="price-filter"> 
                                   <div style="width:100%" class="info">
                                        <span class="secondary label">Rating:</span>
                                    </div> 
                            </div>
                            <div style="width:100%" class="buttonInfo"> 
                                    <div class="inputBox">
                                        <input placeholder="-1" id="ab_player_rating" type="tel" class="numericInput" value=` + window.currentRating + `></div>
                                    </div> 
                            </div>
                            <div style="width:100%" class="button-container"><button id="ab_setting_save" class="btn-standard call-to-action">Save</button></div>
                 </div>`);
                }
            } 
        } else {
            window.setTimeout(snipeFilterInterface, 1000);
        }
    } 

    snipeFilterInterface();

    window.notify = function (message,type) {
        services.Notification.queue([message, type])
    };


    window.saveSettings = function () {
        window.notify("Saving setting , please wait...", enums.UINotificationType.POSITIVE);
        jQuery('.ut-click-shield').addClass('showing');

        let playerFieldString = jQuery('#ab_player_rating').val();  

        jQuery(".loaderIcon ").css("display", "block");
        db.transaction(function (tx) {

            tx.executeSql(`DELETE FROM PlayerId`, [], function (tx, ratingResults) { 
            }, null);

            tx.executeSql(`DELETE FROM CurrentRating`, [], function (tx, ratingResults) { 
            }, null);
             
            let rating = parseInt(playerFieldString);

            if (rating) {
                tx.executeSql(`INSERT INTO CurrentRating (rating) VALUES (${rating})`, [], function (tx, ratingResults) { 
                }, null);
            }
        });

        setTimeout(function () {

            window.currentRating = null;  
            
            var rating = parseInt(playerFieldString);

            if (rating) {
                window.currentRating = rating;
                window.fetchPlayers(rating);
            } 
            if (!rating) {
                jQuery('.ut-click-shield').removeClass('showing');
                jQuery(".loaderIcon ").css("display", "none");
                window.notify("Saved settings successfully", enums.UINotificationType.POSITIVE);
                return;
            }

        }, 1000);
    }

    window.saveSearch = function () {
        window.playerJson = JSON.stringify(this._searchCriteria);
    }

    window.fetchPlayers =  function (rating) {
        jQuery.getJSON(`content/${fut_guid}/${fut_year}/fut/items/web/players.json`, function (res) {
            let playerFilteredIds = [];

            var legendReduced = res.LegendsPlayers.reduce(function (filtered, option) {
                if (rating && option.r === rating) {
                    filtered.push(option.id);
                }
                return filtered;
            }, playerFilteredIds);

            var reduced = res.Players.reduce(function (filtered, option) {
                if (rating && option.r === rating) {
                    filtered.push(option.id);
                }
                return filtered;
            }, playerFilteredIds);

            for (let i = 0; i < playerFilteredIds.length; i++) {
                services.Item.requestItemByDefId(playerFilteredIds[i]).observe(this, (function (sender, response) {
                    let item = response.data.item;
                    db.transaction(function (tx) {
                        tx.executeSql(`INSERT INTO PlayerId (id,nationid,leagueid,teamid) Values (${playerFilteredIds[i]},${item.nationId},${item.leagueId},${item.teamId})`, [], function (tx, ratingResults) {                            
                        });
                    });

                    if (i === playerFilteredIds.length - 1) {
                        jQuery('.ut-click-shield').removeClass('showing');
                        jQuery(".loaderIcon ").css("display", "none"); 
                        window.notify("Saved settings successfully", enums.UINotificationType.POSITIVE);
                    }
                }));
            }
        })
    } 

    jQuery(document).on('click', '#ab_setting_save', saveSettings); 
})();
