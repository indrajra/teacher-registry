import { Component, OnInit } from '@angular/core';
import { DataService } from '../../services/data/data.service';
import { ResourceService } from '../../services/resource/resource.service';
import { ActivatedRoute, Router } from '@angular/router'
import appConfig from '../../services/app.config.json'
import { takeUntil, map, first, debounceTime, delay } from 'rxjs/operators';
import { ICard } from '../../services/interfaces/Card';
import { DomSanitizer } from '@angular/platform-browser'
import { CacheService } from 'ng2-cache-service';
import { UserService } from '../../services/user/user.service';
import _ from 'lodash-es';
import { PermissionService } from 'src/app/services/permission/permission.service';
import { ToasterService } from 'src/app/services/toaster/toaster.service';
import { combineLatest, Subject } from 'rxjs';

@Component({
  selector: 'app-courses',
  templateUrl: './courses.component.html',
  styleUrls: ['./courses.component.scss']
})
export class CoursesComponent implements OnInit {
  dataService: DataService;
  resourceService: ResourceService;
  permissionService: PermissionService;
  activatedRoute: ActivatedRoute;
  userService: UserService;
  router: Router;
  userId: String;
  public viewOwnerProfile: string;
  public showLoader = true;
  public listOfCourses: ICard[] = [];
  result: { "headers": string; "row": {}; };

  constructor(dataService: DataService, resourceService: ResourceService, activatedRoute: ActivatedRoute, router: Router, userService: UserService, public cacheService: CacheService
    , permissionService: PermissionService, public toasterService: ToasterService) {
    this.dataService = dataService
    this.resourceService = resourceService;
    this.router = router
    this.activatedRoute = activatedRoute;
    this.userService = userService;
    this.permissionService = permissionService;
  }

  ngOnInit() {

    this.activatedRoute.params.subscribe((params) => {
      this.userId = params.userId;
      this.viewOwnerProfile = params.role
    });
    this.showLoader = true;
    this.listOfCourses = [];
    this.fetchCourses();
  }

  private fetchCourses() {
    let token = this.cacheService.get(appConfig.cacheServiceConfig.cacheVariables.UserToken);
    if (_.isEmpty(token)) {
      token = this.userService.getUserToken;
    }
    const option = {
      url: appConfig.URLS.READ,
      header: { Authorization: token },
      data: {
        id: appConfig.API_ID.READ,
        request: {
          "Teacher": {
            "osid" : this.userId
          }
        }
      }
    }
    this.dataService.post(option)
      .subscribe(data => {
        if (data.result.Teacher && data.result.Teacher.Courses && data.result.Teacher.Courses.length > 0) {
          this.showLoader = false;
          this.listOfCourses = this.getDataForCard(data.result.Teacher.Courses);
          this.result = {
            "headers": _.keys(this.listOfCourses[0]),
            "row": this.listOfCourses
          }
        } else {
          this.result = {
            "headers": '',
            "row": ''
          }
          this.showLoader = false;
        }
      }, err => {
        this.toasterService.error(this.resourceService.frmelmnts.msg.errorMsg);
        this.showLoader = false;
        this.listOfCourses = [];
      });
  }

  getDataForCard(data) {
    const list: Array<ICard> = [];
    _.forEach(data, (item, key) => {
      const card = this.processContent(item);
      list.push(card);
    });
    return <ICard[]>list;

  }

  processContent(data) {
    const content: any = {
      CourseCode: data.courseCode,
      CourseName: data.courseName,
      IsOnline: data.isOnline,
      IsTADAEligible: data.isTADAEligible,
      Status: data.status,
      Certification: data.certUrl
    };
    return content;
  }

  navigateToHomePage() {
    this.router.navigate(['/search'])
  }

  navigateToProfilePage() {
    this.userId = this.cacheService.get(appConfig.cacheServiceConfig.cacheVariables.EmployeeDetails).osid;
    this.router.navigate(['/profile', this.userId, 'owner'])
  }

  downloadCertification(certUrl){

    const requestData = {
      url: "/download/certificate",
      data: {
        "pdfUrl":certUrl
      }
    };
    var signedCertUrl ="";
    this.dataService.post(requestData).subscribe(response => {
      if (response.result.response === 'success') {
        signedCertUrl = response.result.signedUrl;
        this.dataService.getImage(signedCertUrl).subscribe(
          (res) => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(res);
            a.download = "CourseCertification";
            document.body.appendChild(a);
            a.click();
          });
      
      }else{
        this.toasterService.error(this.resourceService.frmelmnts.msg.downloadFailure);
      }
    }, err => {
      this.toasterService.error(this.resourceService.frmelmnts.msg.downloadFailure);
    });
    
  }
}
