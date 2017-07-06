/**
 * Parses "repeat" attribute.
 *
 * Taken from AngularJS ngRepeat source code
 * See https://github.com/angular/angular.js/blob/v1.2.15/src/ng/directive/ngRepeat.js#L211
 *
 * Original discussion about parsing "repeat" attribute instead of fully relying on ng-repeat:
 * https://github.com/angular-ui/ui-select/commit/5dd63ad#commitcomment-5504697
 */

uis.service('uisRepeatParser', ['uiSelectMinErr','$parse', function(uiSelectMinErr, $parse) {
  var self = this;

  /**
   * Example:
   * expression = "address in addresses | filter: {street: $select.search} track by $index"
   * itemName = "address",
   * source = "addresses | filter: {street: $select.search}",
   * trackByExp = "$index",
   */
  self.parse = function(expression) {


    var match;
    //var isObjectCollection = /\(\s*([\$\w][\$\w]*)\s*,\s*([\$\w][\$\w]*)\s*\)/.test(expression);
    // If an array is used as collection

    // if (isObjectCollection){
    // 000000000000000000000000000000111111111000000000000000222222222222220033333333333333333333330000444444444444444444000000000000000055555555555000000000000000000000066666666600000000
    match = expression.match(/^\s*(?:([\s\S]+?)\s+as\s+)?(?:([\$\w][\$\w]*)|(?:\(\s*([\$\w][\$\w]*)\s*,\s*([\$\w][\$\w]*)\s*\)))\s+in\s+(\s*[\s\S]+?)?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);

    // 1 Alias
    // 2 Item
    // 3 Key on (key,value)
    // 4 Value on (key,value)
    // 5 Source expression (including filters)
    // 6 Track by

    if (!match) {
      throw uiSelectMinErr('iexp', "Expected expression in form of '_item_ in _collection_[ track by _id_]' but got '{0}'.",
              expression);
    }
    
    var source = match[5], 
        filters = '';

    // When using (key,value) ui-select requires filters to be extracted, since the object
    // is converted to an array for $select.items 
    // (in which case the filters need to be reapplied)
    if (match[3]) {
      // Remove any enclosing parenthesis
      source = match[5].replace(/(^\()|(\)$)/g, '');
      // match all after | but not after ||
      var filterMatch = match[5].match(/^\s*(?:[\s\S]+?)(?:[^\|]|\|\|)+([\s\S]*)\s*$/);
      if(filterMatch && filterMatch[1].trim()) {
        filters = filterMatch[1];
        source = source.replace(filters, '');
      }      
    }

    // Try to compute modelToTrackByMapper, such that 
    // modelToTrackByMapper on modelMapper is equivalent to trackByMapper
    // Only in the case where the "as" expression is used in the "track by" exrepssion
    var itemName = match[4] || match[2], 
        trackByMapper = null, 
        modelToTrackByMapper = null;
    if(match[6]){
      // returns all occurences of expr in str as a variable
      var exprIsUsed = function(str, expr){
        // look for occurences of expr in str
        var positions = [], 
            i = 0;
        while(true){
          i = str.indexOf(expr, i);
          if(i < 0) break;
          positions.push([i, i + expr.length]);
          i += expr.length;
        }
        if(!positions.length) return positions;
        // Parse str to look for real occurences of expr as variable
        var backslash = false, 
            string = null, 
            previous = '', 
            found = [];
        var strstart = /['"]/, 
            space = /\s/, 
            letter = /[a-z]/, 
            noprev = /[\w$]|\s*\./, 
            varchar = /[\w$]/;
        for(i = 0; i < str.length; i++){
          if(positions[0][0] == i){
            // expr is escaped, part of a string or inside a longer path
            if(backslash || string || noprev.test(previous)){
              positions.shift();
              if(!positions.length) return found;
            }
          }else if(positions[0][1] == i){
            // check that the next character is not a variable character
            if(!varchar.test(str[i])){
              found.push(positions[0]);
            }
            positions.shift();
            if(!positions.length) return found;
          }
          if(backslash) backslash = false; // this character is escaped
          else if(str[i] === '\\') backslash = true; // next character is escaped
          else if(string){ // inside a string
            if(str[i] === string) string = null; // last character of this string
          }else if(strstart.test(str[i])){ // first character of a string
            string = str[i];
            previous = '';
          }else if(space.test(str[i])){ // a space, can be end of an operator like "in" or "typeof"
            if(letter.test(previous)) previous = '';
          }else previous = str[i]; // another character
        }
        // expr is at the end
        found.push(positions[0]);
        return found;
      };
      // if $index is used in "track by" expression, it cannot be used for matching
      if(!exprIsUsed(match[6], '$index').length){
        trackByMapper = $parse(match[6]);
        // if $index is used in "as" expression, it cannot be used for matching
        if(match[1] && !exprIsUsed(match[1], '$index').length){
          // Check that every occurrence of itemName in the "track by" expresison is inside a copy of the "as" expression
          // and replace every occurence of the "as" expression in the "track by" by itemName
          var itempos = exprIsUsed(match[6], itemName);
          var modelpos = exprIsUsed(match[6], match[1]);
          var parts = [], 
              index = 0;
          while(modelpos.length){
            // this occurence of itemName is inside this copy of "as" expression
            if(itempos.length && itempos[0][0] >= modelpos[0][0] && itempos[0][1] <= modelpos[0][1]){
              itempos.shift();
            }else{ // there is not other occurence of itemName inside this copy of "as" expression
              parts.push(match[6].substring(index, modelpos[0][0]), itemName);
              index = modelpos[0][1];
              modelpos.shift();
            }
          }
          parts.push(match[6].substring(index, match[6].length));
          if(!itempos.length){ // all occurences of itemName were inside a copy of the "as" expression
            try{ modelToTrackByMapper = $parse(parts.join(''));
            }catch(e){} // ignore errors of parsing in absurdly complex case
          }
        }
      }
    }

    return {
      itemName: itemName, // (lhs) Left-hand side,
      keyName: match[3], //for (key, value) syntax
      source: $parse(source),
      filters: filters,
      trackByExp: match[6],
      trackByMapper: trackByMapper,
      modelToTrackByMapper: modelToTrackByMapper,
      modelMapper: $parse(match[1] || itemName),
      repeatExpression: function (grouped) {
        var expression = this.itemName + ' in ' + (grouped ? '$group.items' : '$select.items');
        if (this.trackByExp) {
          expression += ' track by ' + this.trackByExp;
        }
        return expression;
      } 
    };

  };

  self.getGroupNgRepeatExpression = function() {
    return '$group in $select.groups track by $group.name';
  };

}]);
