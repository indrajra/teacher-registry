import { Component, OnInit } from '@angular/core';
import { DataService } from '../../services/data/data.service';
import { ResourceService } from '../../services/resource/resource.service';
import { ActivatedRoute, Router } from '@angular/router'
import appConfig from '../../services/app.config.json'
import { DomSanitizer } from '@angular/platform-browser'
import { CacheService } from 'ng2-cache-service';
import { UserService } from '../../services/user/user.service';
import _ from 'lodash-es';
import { PermissionService } from 'src/app/services/permission/permission.service';
import { ToasterService } from 'src/app/services/toaster/toaster.service';
import { FormService } from 'src/app/services/forms/form.service';

@Component({
  selector: 'app-school-info',
  templateUrl: './school-info.component.html',
  styleUrls: ['./school-info.component.scss']
})
export class SchoolInfoComponent implements OnInit {
  dataService: DataService;
  resourceService: ResourceService;
  permissionService: PermissionService;
  router: Router;
  activatedRoute: ActivatedRoute;
  userId: String;
  userProfile: any = {};
  downloadJsonHref: any;
  userService: UserService;
  public formFieldProperties: any;
  public showLoader = true;
  public viewOwnerProfile: string;
  public editProfile: Array<string>;
  enable: boolean = false;
  categories: any = {};
  sections = []
  formInputData = {};
  userInfo: string;

  constructor(dataService: DataService, resourceService: ResourceService, activatedRoute: ActivatedRoute, router: Router, userService: UserService, public cacheService: CacheService
    , permissionService: PermissionService, public toastService: ToasterService, public formService: FormService) {
    this.dataService = dataService
    this.resourceService = resourceService;
    this.router = router
    this.activatedRoute = activatedRoute;
    this.userService = userService;
    this.permissionService = permissionService;
  }

  ngOnInit() {
    this.editProfile = appConfig.rolesMapping.editProfileRole;
    this.activatedRoute.params.subscribe((params) => {
      this.userId = params.userId;
      this.viewOwnerProfile = params.role
    });
    if (_.isEmpty(this.viewOwnerProfile) && this.viewOwnerProfile == undefined) {
      this.enable = true;
    }
    this.getUserDetails();
  }


  createSubObjectForFormInput() {
    _.map(this.formFieldProperties, field => {
      if (field.inputType === 'object') {
        if (!this.formInputData[field]) {
          this.formInputData[field.code] = {};
        }
      }
    });

  }

  getFormTemplate() {
    this.formService.getFormConfig("school").subscribe(formFieldProperties => {
      this.formFieldProperties = formFieldProperties.fields;
      this.categories = formFieldProperties.categories;
      this.disableEditMode()
    });
  }

  disableEditMode() {
    _.map(this.formFieldProperties, field => {
      if (field.inputType === 'object') {
        _.map(field.attributes, atr => {
          if (atr.hasOwnProperty('editable')) {
            atr['editable'] = false;
            atr['required'] = false;
            if (atr.inputType === 'select')
              atr['inputType'] = "text";
          }
        });
      } else {
        if (field.hasOwnProperty('editable')) {
          field['editable'] = false;
          field['required'] = false;
          if (field.inputType === 'select')
            field['inputType'] = "text";
        }
      }

    });
    this.showLoader = false;
    this.getCategory()
  }

  getCategory() {
    _.map(this.categories, (value, key) => {
      var filtered_people = _.filter(this.formFieldProperties, function (field) {
        return _.includes(value, field.code);
      });
      this.sections.push({ name: key, fields: filtered_people });
    });
  }
  navigateToEditPage() {
    if (this.viewOwnerProfile) {
      this.router.navigate(['/edit', this.userId, this.viewOwnerProfile]);
    } else {
      this.router.navigate(['/edit', this.userId]);
    }
  }

  navigateToHomePage() {
    this.router.navigate(['/school'])
  }

  getUserDetails() {
    let token = this.cacheService.get(appConfig.cacheServiceConfig.cacheVariables.UserToken);
    if (_.isEmpty(token)) {
      token = this.userService.getUserToken;
    }
    const requestData = {
      header: { Authorization: token },
      data: {
        id: appConfig.API_ID.READ,
        request: {
          School: {
            osid: this.userId
          },
          includeSignatures: true,
        }
      },
      url: appConfig.URLS.READ,
    }
    this.dataService.post(requestData).subscribe(response => {
      this.getFormTemplate();
      if (response.params.status === 'SUCCESSFUL') {
        this.formInputData = response.result.School;
        this.userInfo = JSON.stringify(response.result.School)
        this.createSubObjectForFormInput();
      } else {
        this.createSubObjectForFormInput();
      }
    }, (err => {
      console.log(err)
    }))
  }
}

