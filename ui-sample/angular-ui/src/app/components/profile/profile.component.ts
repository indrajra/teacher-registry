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

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
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
  qrCodeUrl = "";
  
  constructor(dataService: DataService, resourceService: ResourceService, activatedRoute: ActivatedRoute, router: Router, userService: UserService, public cacheService: CacheService
    , permissionService: PermissionService, public toastService: ToasterService) {
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
    var requestData = {}
    if (this.viewOwnerProfile === 'owner') {
      requestData = {
        url: appConfig.URLS.OWNER_FORM_TEMPLATE
      }
    } else {
      let token = this.cacheService.get(appConfig.cacheServiceConfig.cacheVariables.UserToken);
      if (_.isEmpty(token)) {
        token = this.userService.getUserToken;
      }
      requestData = {
        url: appConfig.URLS.FORM_TEPLATE,
        header: {
          Authorization: token
        }
      }
    }
    this.dataService.get(requestData).subscribe(res => {
      if (res.responseCode === 'OK') {
        this.formFieldProperties = res.result.formTemplate.data.fields;
        this.categories = res.result.formTemplate.data.categories;
        this.disableEditMode()
      }
    });
  }

  disableEditMode() {
    _.map(this.formFieldProperties, field => {
      if (field.hasOwnProperty('editable')) {
        field['editable'] = false;
        field['required'] = false;
        if (field.inputType === 'select')
          field['inputType'] = "text";
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
    this.router.navigate(['/search'])
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
          Teacher: {
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
        this.formInputData = response.result.Teacher;
        this.userInfo = JSON.stringify(response.result.Teacher)
        var qrcodeReq = {
          name: response.result.Teacher.name,
          profile: window.origin + "/users/" + response.result.Teacher.osid,
          photoUrl: response.result.Teacher.photoUrl,
          code: response.result.Teacher.code,
          isActive: response.result.Teacher.isActive
        };
        this.getQrCode(qrcodeReq);
        this.createSubObjectForFormInput();
      } else {
        this.createSubObjectForFormInput();
      }
    }, (err => {
      console.log(err)
    }))
  }

  getQrCode(qrcodeReq) {
    const requestData = {
      url: "/profile/qrImage",
      body: {
        request: qrcodeReq
      }
    };

    this.dataService.getImg(requestData).subscribe(response => {
      this.qrCodeUrl = response;
    });
  }

  downloadQrImage() {
    this.dataService.getImage(this.qrCodeUrl).subscribe(
      (res) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(res);
        a.download = "QrCodeImage";
        document.body.appendChild(a);
        a.click();
      });
  }
}

