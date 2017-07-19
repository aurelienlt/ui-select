uis.directive('uiSelectSingle', ['$timeout','$compile', function($timeout, $compile) {
  return {
    restrict: 'EA',
    require: ['^uiSelect', '^ngModel'],
    link: function(scope, element, attrs, ctrls) {

      var $select = ctrls[0];
      var ngModel = ctrls[1];

      //From view --> model
      ngModel.$parsers.unshift(function () {
        // Keep original value for undefined and null
        if (isNil($select.selected)) {
          return $select.selected;
        }

        var locals = {},
            result;
        locals[$select.parserResult.itemName] = $select.selected;
        result = $select.parserResult.modelMapper(scope, locals);
        return result;
      });

      // compute the keys of a model value, to match against the items
      var keyOfModel = function(model){
        var locals = {};
        locals[$select.parserResult.itemName] = model;
        return {
          model: model,
          trackBy: $select.parserResult.trackByMapper && $select.parserResult.trackByMapper(scope, locals),
          modelTotrackBy: $select.parserResult.modelToTrackByMapper && $select.parserResult.modelToTrackByMapper(scope, locals),
        };
      };

      // compute the keys of an item, to match against the model value
      var keyOfItem = function(item){
        var locals = {};
        locals[$select.parserResult.itemName] = item;
        return {
          item: item,
          model: $select.parserResult.modelMapper(scope, locals),
          trackBy: $select.parserResult.trackByMapper && $select.parserResult.trackByMapper(scope, locals),
        };
      };

      // compare the keys of the model and the item
      var valueMatchItem = function(value, item){
        // check the following cases:
        // * value is equals to item (formatted as a choice)
        // * value is equals to item (formatted as a model)
        // * the "track by" ids of value (formatted as a choice) and item are the same
        // * the "track by" ids of value (formatted as a model) and item are the same
        if(angular.equals(value.model, item.model) || angular.equals(value.model, item.item)) return true;
        if($select.parserResult.trackByMapper){
          if(value.trackBy === item.trackBy) return true;
          if($select.parserResult.modelToTrackByMapper){
            if(value.modelTotrackBy === item.trackBy) return true;
          }
        }
        return false;
      };

      var nextResolved; //= undefined;
      //From model --> view
      ngModel.$formatters.unshift(function (inputValue) {
        nextResolved = false; // resolved for the next $render call
        setTimeout(function(){
          nextResolved = undefined;
        });
        // Keep original value for undefined and null
        if (isNil(inputValue)) {
          nextResolved = true;
          return inputValue;
        }

        var data = $select.parserResult && $select.parserResult.source (scope, { $select : {search:''}}); //Overwrite $search
        var value = keyOfModel(inputValue);
        //If possible pass same object stored in $select.selected
        if(!isNil($select.selected) && $select.resolved && valueMatchItem(value, keyOfItem($select.selected))){
          nextResolved = true;
          return $select.selected;
        }
        //Check model array of all items available
        if(data){
          for(var i = data.length - 1; i >= 0; i--){
            if(valueMatchItem(value, keyOfItem(data[i]))){
              nextResolved = true;
              return data[i];
            }
          }
        }
        return inputValue;
      });

      // // perform a new resolving when the choices change. It does not seem to be necessary
      // scope.$on('uis:refresh', function (event) {
      //   if(!$select.items.length || $select.resolved) return;
      //   var search = $select.items.map(keyOfItem);
      //   var value = keyOfModel($select.selected);
      //   for(var i = search.length - 1; i >= 0; i--){
      //     if(valueMatchItem(value, search[i])){
      //       $select.selected = search[i].item;
      //       $select.resolved = true;
      //       break;
      //     }
      //   }
      // });

      // Update viewValue if model change
      scope.$watch('$select.selected', function(newValue) {
        if (ngModel.$viewValue !== newValue) {
          ngModel.$setViewValue(Date.now());
        }
      });

      ngModel.$render = function() {
        $select.selected = ngModel.$viewValue;
        $select.resolved = nextResolved || false;
        nextResolved = undefined;
      };

      scope.$on('uis:select', function (event, item) {
        // Check if the item is null
        if(isNil(item)) $select.resolved = true;
        // Check if the item is the same as the selected
        else if(angular.equals($select.selected, item));
        // Check if the item comes from the choices
        else if($select.items.indexOf(item) > -1) $select.resolved = true;
        else{
          var value = keyOfModel(item);
          // Check if the item matches the resolved selected item
          if(!isNil($select.selected) && $select.resolved && valueMatchItem(value, keyOfItem($select.selected))){
            item = $select.selected;
          // Check if the item is not present in the choices
          }else{
            $select.resolved = false;
            for(var i = $select.items.length - 1; i >= 0; i--){
              if(valueMatchItem(value, keyOfItem($select.items[i]))){
                item = $select.items[i];
                $select.resolved = true;
              }
            }
          }
        }
        $select.selected = item;

        var locals = {};
        locals[$select.parserResult.itemName] = item;
        $timeout(function() {
          $select.onSelectCallback(scope, {
            $item: item,
            $model: isNil(item) ? item : $select.parserResult.modelMapper(scope, locals)
          });
        });
      });

      scope.$on('uis:close', function (event, skipFocusser) {
        $timeout(function(){
          $select.focusser.prop('disabled', false);
          if (!skipFocusser) $select.focusser[0].focus();
        },0,false);
      });

      scope.$on('uis:activate', function () {
        focusser.prop('disabled', true); //Will reactivate it on .close()
      });

      //Idea from: https://github.com/ivaynberg/select2/blob/79b5bf6db918d7560bdd959109b7bcfb47edaf43/select2.js#L1954
      var focusser = angular.element("<input ng-disabled='$select.disabled' class='ui-select-focusser ui-select-offscreen' type='text' id='{{ $select.focusserId }}' aria-label='{{ $select.focusserTitle }}' aria-haspopup='true' role='button' />");
      $compile(focusser)(scope);
      $select.focusser = focusser;

      //Input that will handle focus
      $select.focusInput = focusser;

      element.parent().append(focusser);
      focusser.bind("focus", function(){
        scope.$evalAsync(function(){
          $select.focus = true;
        });
      });
      focusser.bind("blur", function(){
        scope.$evalAsync(function(){
          $select.focus = false;
        });
      });
      focusser.bind("keydown", function(e){

        if (e.which === KEY.BACKSPACE && $select.backspaceReset !== false) {
          e.preventDefault();
          e.stopPropagation();
          $select.select(undefined);
          scope.$apply();
          return;
        }

        if (e.which === KEY.TAB || KEY.isControl(e) || KEY.isFunctionKey(e) || e.which === KEY.ESC) {
          return;
        }

        if (e.which == KEY.DOWN  || e.which == KEY.UP || e.which == KEY.ENTER || e.which == KEY.SPACE){
          e.preventDefault();
          e.stopPropagation();
          $select.activate();
        }

        scope.$digest();
      });

      focusser.bind("keyup input", function(e){

        if (e.which === KEY.TAB || KEY.isControl(e) || KEY.isFunctionKey(e) || e.which === KEY.ESC || e.which == KEY.ENTER || e.which === KEY.BACKSPACE) {
          return;
        }

        $select.activate(focusser.val()); //User pressed some regular key, so we pass it to the search input
        focusser.val('');
        scope.$digest();

      });


    }
  };
}]);
