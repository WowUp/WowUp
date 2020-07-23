import { Directive, ElementRef } from '@angular/core';
import { shell } from 'electron'

@Directive({
  selector: '[appExternalLink]'
})
export class ExternalLinkDirective {

  constructor(el: ElementRef) {
    el.nativeElement.addEventListener('click', evt => {
      console.log(evt);
      evt.preventDefault();

      const target = evt.path.find(t => t.tagName === 'A');
      console.log(target);

      shell.openExternal(target.href)
    });
  }

}
